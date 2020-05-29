const { Dbh } = require( "../../dbd" );
const net = require( "net" );
const crypto = require( "crypto" );
const { res } = require( "../../../result" );

const { SQL_MAX_PARAMS_PGSQL } = require( "../../../const" );
const PROTOCOL_VERSION = Buffer.from( [0x00, 0x03, 0x00, 0x00] ); // v3
const LENGTH_PLACEHOLDER = Buffer.from( [0x00, 0x00, 0x00, 0x00] );

// FRONTEND MESSAGES
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

// BACKEND MESSAGES
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

const BACKEND_METHOD = Object.fromEntries( Object.keys( BACKEND ).map( ( key ) => [BACKEND[key], "_ON_PG_" + key] ) );

const TRANSACTION_STATE = {
    "I": false, // idle, not in transaction
    "T": true, // in transaction block
    "E": true, // in a failed transaction block (queries will be rejected until block is ended)
};

// COPY
// const COPY_DATA = "d"; // frontend, backend
// const COPY_DONE = "c"; // frontend, backend
// const COPY_FAIL = "f"; // frontend
// const COPY_IN_RESPONSE = "G"; // backend
// const COPY_OUT_RESPONSE = "H"; // backend
// const COPY_BOTH_RESPONSE = "W"; // backend

const ERROR_RESPONCE_TYPE = {
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

// TODO
const TYPES = {
    "BYTEA": 17,
    "BOOL": 16,
};

module.exports = class DbhPgsql extends Dbh {
    isPgsql = true;

    #pool;
    #options;

    #sessionParams = {};
    #sessionKeyData = {
        "pid": null,
        "secret": null,
    };

    #socket;
    #rbuf;
    #wbuf = [];

    #prepared = {};
    #isConnected = false;
    #transactionState = "I"; // in "idle" state by default

    #sth;

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
            this._onFatalError( res( [500, "Dbh connection closed"] ) );
        } );

        this.#socket.once( "error", ( e ) => {
            this._onFatalError( res( e.message ) );
        } );
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

    _onFatalError ( res ) {

        // cleanup socket
        this.#socket.removeAllListeners();
        this.#socket = null;

        if ( this.#isConnected ) {
            this.#isConnected = false;

            this.#pool._onDbhReady( this );

            this._finishRequest( res );
        }
        else {
            this.#pool._onDbhConnectError( res );
        }
    }

    // TODO parse rows from rows tag
    // TODO use position and sth.query in error message
    _finishRequest ( result ) {
        var sth = this.#sth;

        if ( !sth ) return;

        this.#sth = null;

        if ( !result ) {
            if ( sth.error ) {

                // TODO use query and position
                result = res( [500, sth.error.message] );
            }
            else {
                result = res( 200, sth.data );

                // TODO parse rows
                result.rows = sth.rowsTag;
            }
        }

        sth.resolve( result );
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

    // POSTGRES MESSAGE HANDLERS
    _ON_PG_AUTHENTICATION ( data ) {
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

    _ON_PG_PARAMETER_STATUS ( data ) {
        var [key, val] = data.toString().split( "\0" );

        this.#sessionParams[key] = val;
    }

    _ON_PG_BACKEND_KEY_DATA ( data ) {

        // Identifies the message as cancellation key data.
        // The frontend must save these values if it wishes to be able to issue CancelRequest messages later.

        this.#sessionKeyData.pid = data.readUInt32BE();

        this.#sessionKeyData.secret = data.readUInt32BE( 4 );
    }

    _ON_PG_READY_FOR_QUERY ( data ) {
        this.#transactionState = data.toString();

        if ( !this.#isConnected ) this.#isConnected = true;

        this.#pool._onDbhReady( this );

        this._finishRequest();
    }

    _ON_PG_ERROR_RESPONSE ( data ) {
        var error = {};

        for ( const field of data.toString().split( "\0" ) ) {
            if ( !field ) continue;

            error[ERROR_RESPONCE_TYPE[field.charAt( 0 )]] = field.substr( 1 );
        }

        if ( this.#sth ) {
            this.#sth.error = error;
        }
        else {
            this._onFatalError( res( [500, error.message] ) );
        }
    }

    _ON_PG_ROW_DESCRIPTION ( data ) {
        var numOfCols = data.readInt16BE(),
            pos = 2,
            columns = [];

        for ( let n = 0; n < numOfCols; n++ ) {
            let idx = data.indexOf( "\0", pos );

            const column = [

                //
                data.toString( "binary", pos, idx ), // column name
                data.readInt32BE( ( idx += 1 ) ), // If the field can be identified as a column of a specific table, the object ID of the table; otherwise zero.
                data.readInt16BE( ( idx += 4 ) ), // If the field can be identified as a column of a specific table, the attribute number of the column; otherwise zero.
                data.readInt32BE( ( idx += 2 ) ), // The object ID of the field's data type.
                data.readInt16BE( ( idx += 4 ) ), // The data type size (see pg_type.typlen). Note that negative values denote variable-width types., -1 - indicates a "varlena" type (one that has a length word);, -2 - indicates a null-terminated C string;
                data.readInt32BE( ( idx += 2 ) ), // The type modifier (see pg_attribute.atttypmod). The meaning of the modifier is type-specific.
                data.readInt16BE( ( idx += 4 ) ), // The format code being used for the field. Currently will be 0 (text) or 1 (binary). In a RowDescription returned from the statement variant of Describe, the format code is not yet known and will always be zero.
            ];

            pos = idx + 2;

            columns.push( column );
        }

        this.#sth.columns = columns;

        // query is prepared, sore clumns descriptions
        if ( this.#sth.id ) {
            if ( !this.#prepared[this.#sth.id] ) this.#prepared[this.#sth.id] = {};

            this.#prepared[this.#sth.id].columns = columns;
        }
    }

    // TODO convert types
    _ON_PG_DATA_ROW ( data ) {
        var numOfCols = data.readUInt16BE(),
            columns = this.#sth.columns,
            pos = 2,
            row = {};

        for ( let n = 0; n < numOfCols; n++ ) {
            const length = data.readInt32BE( pos );
            let col;

            pos += 4;

            // col is ""
            if ( !length ) {
                col = "";
            }

            // col is null
            else if ( length === -1 ) {
                col = null;
            }

            // col has data
            else {
                const type = columns[n][3];

                if ( type === TYPES.BYTEA ) {
                    col = data.slice( pos, ( pos += length ) );
                }
                else if ( type === TYPES.BOOL ) {
                    col = data.toString( "binary", pos, ( pos += length ) ) === "f" ? false : true;
                }
                else {

                    // TODO
                    col = data.toString( "binary", pos, ( pos += length ) );
                }
            }

            row[columns[n][0]] = col;
        }

        this.#sth.data.push( row );
    }

    _ON_PG_COMMAND_COMPLETE ( data ) {
        this.#sth.rowsTag = data.toString( "binary", 0, data.length - 1 );
    }

    // QUERY
    async do ( query, params ) {
        return new Promise( ( resolve ) => {
            const onFinish = ( res ) => {
                res.data = null;

                resolve( res );
            };

            this._exec( onFinish, query, params );
        } );
    }

    async selectAll ( query, params ) {
        return new Promise( ( resolve ) => {
            this._exec( resolve, query, params );
        } );
    }

    async selectRow ( query, params ) {
        return new Promise( ( resolve ) => {
            const onFinish = ( res ) => {
                if ( res.data ) res.data = res.data[0];

                resolve( res );
            };

            this._exec( onFinish, query, params, 1 );
        } );
    }

    // TODO
    _exec ( resolve, query, params, maxRows ) {
        query = this._prepareQuery( query, params );

        this.#sth = {
            resolve,
            "id": query[2],
            "query": query[0],
            "error": null,
            "columns": null,
            "data": [],
        };

        // use simple query if query has no params, query is not prepared, no maxRows defined
        const useSimpleQuery = !( query[1] || query[2] || maxRows );

        // for simple query multiple queries in single statement are allowed
        if ( useSimpleQuery ) {
            this._push( FRONTEND.QUERY, [query[0] + "\0"] );
        }

		// extended query mode
        else {

            //
        }

        this._send();
    }

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
        if ( query[1] && query[1].length > SQL_MAX_PARAMS_PGSQL ) {
            return [this.queryToString( query[0], query[1] ), null, null];
        }
        else {
            return query;
        }
    }
};
