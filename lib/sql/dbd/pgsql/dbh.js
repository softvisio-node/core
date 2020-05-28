const { Dbh } = require( "../../dbd" );
const net = require( "net" );
const crypto = require( "crypto" );
const { res } = require( "../../../result" );
const { SQL_MAX_PARAMS_PGSQL } = require( "../../../const" );

const PROTOCOL_VERSION = Buffer.from( [0x00, 0x03, 0x00, 0x00] ); // v3
const LENGTH_PLACEHOLDER = Buffer.from( [0x01, 0x00, 0x00, 0x00] );

// FRONTEND
const PG_MSG_BIND = "B";
const PG_MSG_CANCEL_REQUEST = "";
const PG_MSG_CLOSE = "C";
const PG_MSG_CLOSE_STATEMENT = "S";
const PG_MSG_CLOSE_PORTAL = "P";
const PG_MSG_DESCRIBE = "D";
const PG_MSG_EXECUTE = "E";
const PG_MSG_FLUSH = "H";
const PG_MSG_FUNCTION_CALL = "F";
const PG_MSG_PARSE = "P";
const PG_MSG_PASSWORD_MESSAGE = "p";
const PG_MSG_QUERY = "Q";
const PG_MSG_SSL_REQUEST = "";
const PG_MSG_STARTUP_MESSAGE = "";
const PG_MSG_SYNC = "S";
const PG_MSG_TERMINATE = "X";

// BACKEND
const PG_MSG_AUTHENTICATION = "R";
const PG_MSG_AUTHENTICATION_OK = 0;
const PG_MSG_AUTHENTICATION_KERBEROS_V5 = 2;
const PG_MSG_AUTHENTICATION_CLEARTEXT_PASSWORD = 3;
const PG_MSG_AUTHENTICATION_MD5_PASSWORD = 5;
const PG_MSG_AUTHENTICATION_SCM_CREDENTIAL = 6;
const PG_MSG_AUTHENTICATION_GSS = 7;
const PG_MSG_AUTHENTICATION_GSS_CONTINUE = 8;
const PG_MSG_AUTHENTICATION_SSPI = 9;
const PG_MSG_BACKEND_KEY_DATA = "K";
const PG_MSG_BIND_COMPLETE = 2;
const PG_MSG_CLOSE_COMPLETE = 3;
const PG_MSG_COMMAND_COMPLETE = "C";
const PG_MSG_DATA_ROW = "D";
const PG_MSG_EMPTY_QUERY_RESPONSE = "I";
const PG_MSG_ERROR_RESPONSE = "E";
const PG_MSG_FUNCTION_CALL_RESPONSE = "V";
const PG_MSG_NO_DATA = "n";
const PG_MSG_NOTICE_RESPONSE = "N";
const PG_MSG_NOTIFICATION_RESPONSE = "A";
const PG_MSG_PARAMETER_DESCRIPTION = "t";
const PG_MSG_PARAMETER_STATUS = "S";
const PG_MSG_PARSE_COMPLETE = 1;
const PG_MSG_PORTAL_SUSPENDED = "s";
const PG_MSG_READY_FOR_QUERY = "Z";
const PG_MSG_ROW_DESCRIPTION = "T";

// COPY
const PG_MSG_COPY_DATA = "d"; // frontend, backend
const PG_MSG_COPY_DONE = "c"; // frontend, backend
const PG_MSG_COPY_FAIL = "f"; // frontend
const PG_MSG_COPY_IN_RESPONSE = "G"; // backend
const PG_MSG_COPY_OUT_RESPONSE = "H"; // backend
const PG_MSG_COPY_BOTH_RESPONSE = "W"; // backend

const ERROR_STRING_TYPE = {
    "S": "severity",
    "C": "code",
    "M": "message",
    "D": "detail",
    "H": "hint",
    "P": "position",
    "p": "internal_position",
    "q": "internal_query",
    "W": "where",
    "F": "file",
    "L": "line",
    "R": "routine",
    "V": "text",
};

module.exports = class DbhPgsql extends Dbh {
    isPgsql = true;

    #options;
    #maxParams = SQL_MAX_PARAMS_PGSQL;
    #prepared = {};
    #pool;
    #socket;
    #isConnected = false;
    #inTransaction = false;
    #onFinishRequest;
    #rbuf;
    #wbuf = [];

    constructor ( pool, options ) {
        super();

        this.#pool = pool;
        this.#options = options;

        this._connect();
    }

    async _connect () {
        this.#socket = net.connect( {
            "host": this.#options.host,
            "port": this.#options.port,
        } );

        this.#socket.once( "connect", () => {
            this._onConnect();
        } );

        this.#socket.on( "data", this._onData.bind( this ) );

        this.#socket.on( "close", ( hadError ) => {
            this.#socket.removeAllListeners();

            this.#socket = null;

            if ( this.#isConnected ) {
                this.#isConnected = false;

                this.#pool._pushDbh( this );
            }
            else {
                this.#pool._onDbhConnectError( res( [500, "Dbh connection closed"] ) );
            }

            this._onFinishRequest( res( [500, "Dbh connection closed"] ) );
        } );

        this.#socket.on( "error", ( e ) => {} );
    }

    inTransaction () {
        return this.#inTransaction;
    }

    quote ( value ) {
        return this.#pool.quote( value );
    }

    _isConnected () {
        return this.#isConnected;
    }

    _push ( id, data ) {
        var buf = Buffer.concat( [Buffer.from( id ), LENGTH_PLACEHOLDER, ...data.map( ( item ) => ( Buffer.isBuffer( item ) ? item : Buffer.from( item ) ) )] );

        buf.writeUInt32BE( buf.length - id.length, id.length );

        this.#wbuf.push( buf );
    }

    _send () {
        if ( !this.#wbuf.length ) return;

        if ( this.#wbuf.length === 1 ) {
            this.#socket.write( this.#wbuf[0] );
        }
        else {
            this.#socket.write( Buffer.concat( this.#wbuf ) );
        }

        this.#wbuf = [];
    }

    _onConnect () {
        var params = {
            "user": this.#options.username,
            "database": this.#options.db,
            "options": "--client-min-messages=warning",
            "replication": "false",

            // session run-time params
            "client_encoding": "UTF8",
            "bytea_output": "hex",
            "backslash_quote": "off",
            "standard_conforming_strings": "on",
        };

        this._push( PG_MSG_STARTUP_MESSAGE, [PROTOCOL_VERSION, ...Object.keys( params ).map( ( param ) => `${param}\0${params[param]}\0` ), "\0"] );

        this._send();
    }

    _onData ( data ) {
        if ( this.#rbuf ) {
            this.#rbuf = Buffer.concat( [this.#rbuf, data] );
        }
        else {
            this.#rbuf = data;
        }

        while ( this.#rbuf.length > 4 ) {
            var length = this.#rbuf.readUInt32BE( 1 );

            if ( this.#rbuf.length >= length + 1 ) {
                const msgId = this.#rbuf.toString( "binary", 0, 1 ),
                    body = this.#rbuf.slice( 5, length + 1 );

                this.#rbuf = this.#rbuf.slice( length + 1 );

                console.log( msgId );

                if ( msgId === "R" ) {
                    this._ON_PG_AUTHENTICATION( body );
                }
            }
            else {
                break;
            }
        }

        // this.#isConnected = true;
        // this.#pool._pushDbh( this );
    }

    _ON_PG_AUTHENTICATION ( data ) {
        var type = data.readUInt32BE();

        if ( type === PG_MSG_AUTHENTICATION_OK ) {

            // auth is ok
        }
        else if ( type === PG_MSG_AUTHENTICATION_CLEARTEXT_PASSWORD ) {
            this._send( PG_MSG_PASSWORD_MESSAGE, this.#options.password || "", "\0" );

            this._send();
        }
        else if ( type === PG_MSG_AUTHENTICATION_MD5_PASSWORD ) {
            const pwdhash = crypto
                .createHash( "MD5" )
                .update( ( this.#options.password || "" ) + this.#options.username, "utf8" )
                .digest( "hex" );

            const hash =
                "md5" +
                crypto
                    .createHash( "MD5" )
                    .update( pwdhash + data.slice( 4 ).toString( "binary" ), "binary" )
                    .digest( "hex" );

            this._push( PG_MSG_PASSWORD_MESSAGE, [hash, "\0"] );

            this._send();
        }
        else {
            this._onError( res( [500, "Unsupported authentication mathod"] ) );
        }
    }

    // TODO
    _onError ( res ) {}

    // TODO called on socket error or on qiery finished
    _onFinishRequest ( res ) {
        var resolve = this.#onFinishRequest;

        if ( resolve ) {
            this.#onFinishRequest = null;

            resolve( res );
        }
    }

    // QUERY
    // TODO
    async do ( query, params ) {}

    // TODO
    async selectAll ( query, params ) {}

    // TODO
    async selectRow ( query, params ) {}

    _prepareQuery ( query, params ) {

        // query object
        if ( this.isQuery( query ) ) {
            query = query.getQuery( true );

            // override params
            if ( params ) query[1] = params;
        }

        // query is string
        else {

            // convert placeholders from "?" to "$1", only if query passed as string and has params
            if ( params ) {
                let n = 0;

                query = query.replace( /\?/g, () => ++n );
            }

            query = [query, params, null];
        }

        // serialize query if number of params exceeded
        if ( query[1] && query[1].length > this.#maxParams ) {
            return [this.queryToString( query[0], query[1] ), null, null];
        }
        else {
            return query;
        }
    }
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 11:7          | no-unused-vars               | 'PG_MSG_BIND' is assigned a value but never used.                              |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 12:7          | no-unused-vars               | 'PG_MSG_CANCEL_REQUEST' is assigned a value but never used.                    |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 13:7          | no-unused-vars               | 'PG_MSG_CLOSE' is assigned a value but never used.                             |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 14:7          | no-unused-vars               | 'PG_MSG_CLOSE_STATEMENT' is assigned a value but never used.                   |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 15:7          | no-unused-vars               | 'PG_MSG_CLOSE_PORTAL' is assigned a value but never used.                      |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 16:7          | no-unused-vars               | 'PG_MSG_DESCRIBE' is assigned a value but never used.                          |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 17:7          | no-unused-vars               | 'PG_MSG_EXECUTE' is assigned a value but never used.                           |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 18:7          | no-unused-vars               | 'PG_MSG_FLUSH' is assigned a value but never used.                             |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 19:7          | no-unused-vars               | 'PG_MSG_FUNCTION_CALL' is assigned a value but never used.                     |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 20:7          | no-unused-vars               | 'PG_MSG_PARSE' is assigned a value but never used.                             |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 22:7          | no-unused-vars               | 'PG_MSG_QUERY' is assigned a value but never used.                             |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 23:7          | no-unused-vars               | 'PG_MSG_SSL_REQUEST' is assigned a value but never used.                       |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 25:7          | no-unused-vars               | 'PG_MSG_SYNC' is assigned a value but never used.                              |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 26:7          | no-unused-vars               | 'PG_MSG_TERMINATE' is assigned a value but never used.                         |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 29:7          | no-unused-vars               | 'PG_MSG_AUTHENTICATION' is assigned a value but never used.                    |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 31:7          | no-unused-vars               | 'PG_MSG_AUTHENTICATION_KERBEROS_V5' is assigned a value but never used.        |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 34:7          | no-unused-vars               | 'PG_MSG_AUTHENTICATION_SCM_CREDENTIAL' is assigned a value but never used.     |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 35:7          | no-unused-vars               | 'PG_MSG_AUTHENTICATION_GSS' is assigned a value but never used.                |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 36:7          | no-unused-vars               | 'PG_MSG_AUTHENTICATION_GSS_CONTINUE' is assigned a value but never used.       |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 37:7          | no-unused-vars               | 'PG_MSG_AUTHENTICATION_SSPI' is assigned a value but never used.               |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 38:7          | no-unused-vars               | 'PG_MSG_BACKEND_KEY_DATA' is assigned a value but never used.                  |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 39:7          | no-unused-vars               | 'PG_MSG_BIND_COMPLETE' is assigned a value but never used.                     |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 40:7          | no-unused-vars               | 'PG_MSG_CLOSE_COMPLETE' is assigned a value but never used.                    |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 41:7          | no-unused-vars               | 'PG_MSG_COMMAND_COMPLETE' is assigned a value but never used.                  |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 42:7          | no-unused-vars               | 'PG_MSG_DATA_ROW' is assigned a value but never used.                          |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 43:7          | no-unused-vars               | 'PG_MSG_EMPTY_QUERY_RESPONSE' is assigned a value but never used.              |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 44:7          | no-unused-vars               | 'PG_MSG_ERROR_RESPONSE' is assigned a value but never used.                    |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 45:7          | no-unused-vars               | 'PG_MSG_FUNCTION_CALL_RESPONSE' is assigned a value but never used.            |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 46:7          | no-unused-vars               | 'PG_MSG_NO_DATA' is assigned a value but never used.                           |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 47:7          | no-unused-vars               | 'PG_MSG_NOTICE_RESPONSE' is assigned a value but never used.                   |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 48:7          | no-unused-vars               | 'PG_MSG_NOTIFICATION_RESPONSE' is assigned a value but never used.             |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 49:7          | no-unused-vars               | 'PG_MSG_PARAMETER_DESCRIPTION' is assigned a value but never used.             |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 50:7          | no-unused-vars               | 'PG_MSG_PARAMETER_STATUS' is assigned a value but never used.                  |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 51:7          | no-unused-vars               | 'PG_MSG_PARSE_COMPLETE' is assigned a value but never used.                    |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 52:7          | no-unused-vars               | 'PG_MSG_PORTAL_SUSPENDED' is assigned a value but never used.                  |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 53:7          | no-unused-vars               | 'PG_MSG_READY_FOR_QUERY' is assigned a value but never used.                   |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 54:7          | no-unused-vars               | 'PG_MSG_ROW_DESCRIPTION' is assigned a value but never used.                   |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 57:7          | no-unused-vars               | 'PG_MSG_COPY_DATA' is assigned a value but never used.                         |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 58:7          | no-unused-vars               | 'PG_MSG_COPY_DONE' is assigned a value but never used.                         |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 59:7          | no-unused-vars               | 'PG_MSG_COPY_FAIL' is assigned a value but never used.                         |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 60:7          | no-unused-vars               | 'PG_MSG_COPY_IN_RESPONSE' is assigned a value but never used.                  |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 61:7          | no-unused-vars               | 'PG_MSG_COPY_OUT_RESPONSE' is assigned a value but never used.                 |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 62:7          | no-unused-vars               | 'PG_MSG_COPY_BOTH_RESPONSE' is assigned a value but never used.                |
// |-------+---------------+------------------------------+--------------------------------------------------------------------------------|
// | ERROR | 64:7          | no-unused-vars               | 'ERROR_STRING_TYPE' is assigned a value but never used.                        |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
