const { Dbh } = require( "../../dbd" );
const net = require( "net" );
const crypto = require( "crypto" );
const { res } = require( "../../../result" );
const { SQL_MAX_PARAMS_PGSQL } = require( "../../../const" );

const PROTOCOL_VERSION = Buffer.from( [0x00, 0x03, 0x00, 0x00] ); // v3
const LENGTH_PLACEHOLDER = Buffer.from( [0x00, 0x00, 0x00, 0x00] );

// FRONTEND
const FRONTEND = {
    "BIND": "B",
    "CANCEL_REQUEST": "",
    "CLOSE": "C",
    "CLOSE_STATEMENT": "S",
    "CLOSE_PORTAL": "P",
    "DESCRIBE": "D",
    "EXECUTE": "E",
    "FLUSH": "H",
    "FUNCTION_CALL": "F",
    "PARSE": "P",
    "PASSWORD_MESSAGE": "p",
    "QUERY": "Q",
    "SSL_REQUEST": "",
    "STARTUP_MESSAGE": "",
    "SYNC": "S",
    "TERMINATE": "X",
};

const BACKEND = {

    // AUTH
    "AUTHENTICATION": "R",

    // AUTH TYPE
    "AUTHENTICATION_OK": 0,
    "AUTHENTICATION_KERBEROS_V5": 2,
    "AUTHENTICATION_CLEARTEXT_PASSWORD": 3,
    "AUTHENTICATION_MD5_PASSWORD": 5,
    "AUTHENTICATION_SCM_CREDENTIAL": 6,
    "AUTHENTICATION_GSS": 7,
    "AUTHENTICATION_GSS_CONTINUE": 8,
    "AUTHENTICATION_SSPI": 9,

    "BACKEND_KEY_DATA": "K",
    "BIND_COMPLETE": "2",
    "CLOSE_COMPLETE": "3",
    "COMMAND_COMPLETE": "C",
    "DATA_ROW": "D",
    "EMPTY_QUERY_RESPONSE": "I",
    "ERROR_RESPONSE": "E",
    "FUNCTION_CALL_RESPONSE": "V",
    "NO_DATA": "n",
    "NOTICE_RESPONSE": "N",
    "NOTIFICATION_RESPONSE": "A",
    "PARAMETER_DESCRIPTION": "t",
    "PARAMETER_STATUS": "S",
    "PARSE_COMPLETE": "1",
    "PORTAL_SUSPENDED": "s",
    "READY_FOR_QUERY": "Z",
    "ROW_DESCRIPTION": "T",
};

const BACKEND_METHOD = Object.fromEntries( Object.keys( BACKEND ).map( ( key ) => [BACKEND[key], "_ON_PG_MSG_" + key] ) );

const TRANSACTION_STATE = {
    "I": false, // idle, not in transaction
    "T": true, // in transaction block
    "E": true, // if in a failed transaction block (queries will be rejected until block is ended)
};

// COPY
// const COPY_DATA = "d"; // frontend, backend
// const COPY_DONE = "c"; // frontend, backend
// const COPY_FAIL = "f"; // frontend
// const COPY_IN_RESPONSE = "G"; // backend
// const COPY_OUT_RESPONSE = "H"; // backend
// const COPY_BOTH_RESPONSE = "W"; // backend

// const ERROR_STRING_TYPE = {
//     "S": "severity",
//     "C": "code",
//     "M": "message",
//     "D": "detail",
//     "H": "hint",
//     "P": "position",
//     "p": "internal_position",
//     "q": "internal_query",
//     "W": "where",
//     "F": "file",
//     "L": "line",
//     "R": "routine",
//     "V": "text",
// };

module.exports = class DbhPgsql extends Dbh {
    isPgsql = true;

    #options;
    #maxParams = SQL_MAX_PARAMS_PGSQL;
    #sessionParams = {};
    #sessionKeyData = {
        "pid": null,
        "secret": null,
    };
    #prepared = {};
    #pool;
    #socket;
    #isConnected = false;
    #transactionState = "I";
    #onFinishRequest;
    #rbuf;
    #wbuf = [];

    constructor ( pool, options ) {
        super();

        this.#pool = pool;
        this.#options = options;

        this._connect();
    }

    inTransaction () {
        return TRANSACTION_STATE[this.#transactionState];
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

    async _connect () {
        this.#socket = net.connect( {
            "host": this.#options.host,
            "port": this.#options.port,
        } );

        this.#socket.once( "connect", () => {
            this._onConnect();
        } );

        this.#socket.on( "data", this._onData.bind( this ) );

        this.#socket.once( "close", ( hadError ) => {
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

        this.#socket.once( "error", ( e ) => {} );
    }

    async _onConnect () {
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

        this._push( FRONTEND.STARTUP_MESSAGE, [PROTOCOL_VERSION, ...Object.keys( params ).map( ( param ) => `${param}\0${params[param]}\0` ), "\0"] );

        this._send();
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

                this[BACKEND_METHOD[msgId]]( body );
            }
            else {
                break;
            }
        }
    }

    _ON_PG_MSG_AUTHENTICATION ( data ) {
        var type = data.readUInt32BE();

        if ( type === BACKEND.AUTHENTICATION_OK ) {

            // auth is ok
        }
        else if ( type === BACKEND.AUTHENTICATION_CLEARTEXT_PASSWORD ) {
            this._send( FRONTEND.PASSWORD_MESSAGE, this.#options.password || "", "\0" );

            this._send();
        }
        else if ( type === BACKEND.AUTHENTICATION_MD5_PASSWORD ) {
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

            this._push( FRONTEND.PASSWORD_MESSAGE, [hash, "\0"] );

            this._send();
        }
        else {
            this._onError( res( [500, "Unsupported authentication mathod"] ) );
        }
    }

    _ON_PG_MSG_PARAMETER_STATUS ( data ) {
        var [key, val] = data.toString().split( "\0" );

        this.#sessionParams[key] = val;
    }

    // Identifies the message as cancellation key data.
    // The frontend must save these values if it wishes to be able to issue CancelRequest messages later.
    _ON_PG_MSG_BACKEND_KEY_DATA ( data ) {
        this.#sessionKeyData.pid = data.readUInt32BE();

        this.#sessionKeyData.secret = data.readUInt32BE( 4 );
    }

    _ON_PG_MSG_READY_FOR_QUERY ( data ) {
        this.#transactionState = data.toString();

        if ( !this.#isConnected ) {
            this.#isConnected = true;

            this.#pool._pushDbh( this );
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
