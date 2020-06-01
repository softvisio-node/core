const { Dbh } = require( "../../dbd" );
const net = require( "net" );
const crypto = require( "crypto" );
const util = require( "util" );
const { res } = require( "../../../result" );

const { SQL_MAX_PARAMS_PGSQL, SQL_TYPE } = require( "../../../const" );
const TYPES = require( "../../dbi" ).TYPES.pgsql;
const PROTOCOL_VERSION = Buffer.from( [0x00, 0x03, 0x00, 0x00] ); // v3
const ZERO = Buffer.from( "\0" );
const UINT32BE_0 = Buffer.from( [0x00, 0x00, 0x00, 0x00] );
const UINT32BE_1 = Buffer.from( [0x00, 0x00, 0x00, 0x01] );
const UINT32BE_4 = Buffer.from( [0x00, 0x00, 0x00, 0x04] );
const PARAM_FORMAT_TEXT = Buffer.from( [0x00, 0x00] );
const PARAM_NULL = Buffer.alloc( 4 ).fill( 0xff );
const PARAM_TRUE = Buffer.from( "t" );
const PARAM_FALSE = Buffer.from( "f" );

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

const ERROR_RESPONSE_TYPE = {
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

    #queue = [];
    #prepared = {};
    #isDestroyed = false;
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

    _isDestroyed () {
        return this.#isDestroyed;
    }

    _destroy ( result ) {
        if ( this.#isDestroyed ) return;

        this.#isDestroyed = true;
        this.#isConnected = false;

        // cleanup socket
        this.#socket.removeAllListeners();
        this.#socket = null;

        // create result
        if ( !result ) result = res( [500, "Dbh is disconnected"] );

        // cleanup queue
        var queue = this.#queue;

        this.#queue = [];

        // finish current request
        this._finishRequest( result );

        // finish all pending requests
        for ( const sth of queue ) {
            sth.resolve( result );
        }
    }

    _push ( id, buf, send ) {
        if ( send ) {
            const msg = [];

            if ( id !== "" ) msg.push( Buffer.from( id ) );

            const length = Buffer.alloc( 4 );
            length.writeUInt32BE( buf.length + 4 );

            msg.push( length, buf );

            this.#socket.write( Buffer.concat( msg ) );
        }
        else {
            if ( id !== "" ) this.#wbuf.push( Buffer.from( id ) );

            if ( buf ) {
                const length = Buffer.alloc( 4 );
                length.writeUInt32BE( buf.length + 4 );
                this.#wbuf.push( length, buf );
            }
            else {
                this.#wbuf.push( UINT32BE_4 );
            }
        }
    }

    _send () {
        if ( !this.#isConnected ) return;

        if ( this.#wbuf.length === 1 ) {
            this.#socket.write( this.#wbuf[0] );
        }
        else {
            this.#socket.write( Buffer.concat( this.#wbuf ) );
        }

        this.#wbuf = [];
    }

    _connect () {
        this.#socket = net.connect( {
            "host": this.#options.host,
            "port": this.#options.port,
        } );

        this.#socket.once( "connect", this._onConnect.bind( this ) );

        this.#socket.on( "data", this._onData.bind( this ) );

        this.#socket.once( "close", ( hadError ) => {
            this._onFatalError( res( [500, "Dbh is disconnected"] ) );
        } );

        this.#socket.once( "error", ( e ) => {
            this._onFatalError( res( [500, e.message] ) );
        } );
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

        this._push( FRONTEND.STARTUP_MESSAGE,
            Buffer.concat( [
                PROTOCOL_VERSION, //
                ...Object.keys( params ).map( ( param ) => Buffer.from( `${param}\0${params[param]}\0` ) ),
                ZERO,
            ] ),
            true );
    }

    _onFatalError ( res ) {
        this._destroy();

        this.#pool._onDbhError();
    }

    _finishRequest ( result ) {
        var sth = this.#sth;

        if ( !sth ) return;

        this.#sth = this.#queue.shift();

        // compose result
        if ( !result ) {
            if ( sth.error ) {
                result = this._onQueryError( sth.error, sth.query, sth.error.position );
            }
            else {
                result = res( 200, sth.data, { "rows": sth.rows } );
            }
        }

        sth.resolve( result );
    }

    // TODO slice
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

                // TODO remove
                if ( !this[BACKEND_METHOD[msgId]] ) throw `Unhandled postgres message "${msgId}"`;

                this[BACKEND_METHOD[msgId]]( body );
            }
            else {
                break;
            }
        }
    }

    // POSTGRES MESSAGE HANDLERS
    // TODO on error???
    _ON_PG_AUTHENTICATION ( data ) {
        var type = data.readUInt32BE();

        if ( type === BACKEND.AUTHENTICATION_OK ) {

            // auth is ok
        }
        else if ( type === BACKEND.AUTHENTICATION_CLEARTEXT_PASSWORD ) {
            this._push( FRONTEND.PASSWORD_MESSAGE, Buffer.from( ( this.#options.password || "" ) + "\0", "utf8" ), true );
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

            this._push( FRONTEND.PASSWORD_MESSAGE, Buffer.from( hash + "\0" ), true );
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

    // READY FOR QUERY
    _ON_PG_READY_FOR_QUERY ( data ) {
        this.#transactionState = data.toString();

        // dbh is connected
        if ( !this.#isConnected ) {
            this.#isConnected = true;

            // send pending messages
            this._send();
        }

        // query is finished
        else {
            this._finishRequest();
        }
    }

    // ERROR RESPONSE
    _ON_PG_ERROR_RESPONSE ( data ) {
        var error = {};

        // parse error message
        for ( const field of data.toString().split( "\0" ) ) {
            if ( !field ) continue;

            error[ERROR_RESPONSE_TYPE[field.charAt( 0 )]] = field.substr( 1 );
        }

        // error during conenction
        if ( !this.#isConnected ) {
            this._onFatalError( res( [500, error.message] ) );
        }

        // query error
        else if ( this.#sth ) {
            this.#sth.error = error;
        }

        // unknown error
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

        // query is prepared, sore columns descriptions
        if ( this.#sth.id ) {
            this.#prepared[this.#sth.id].columns = columns;
        }
    }

    _ON_PG_NO_DATA ( data ) {
        this.#sth.columns = [];

        // query is prepared, sore columns descriptions
        if ( this.#sth.id ) {
            this.#prepared[this.#sth.id].columns = [];
        }
    }

    // TODO sth.options.ignoreData
    // TODO sth.options.parseDates
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
                const oid = columns[n][3];

                // oid has decoder
                if ( TYPES.from[oid] ) {
                    col = TYPES.from[oid]( data.slice( pos, ( pos += length ) ) );
                }

                // use default decoder, to utf8 string
                else {
                    col = data.toString( "utf8", pos, ( pos += length ) );
                }
            }

            row[columns[n][0]] = col;
        }

        this.#sth.data.push( row );
    }

    _ON_PG_COMMAND_COMPLETE ( data ) {
        this.#sth.rowsTag = data.toString( "binary", 0, data.length - 1 );

        const rows = this.#sth.rowsTag.match( /\s(\d+)$/ );

        if ( rows ) this.#sth.rows = +rows[1];
    }

    _ON_PG_PARSE_COMPLETE ( data ) {
        this.#sth.parseComplete = true;

        if ( this.#sth.id ) {
            this.#prepared[this.#sth.id].parseComplete = true;
        }
    }

    _ON_PG_BIND_COMPLETE ( data ) {
        this.#sth.bindComplete = true;
    }

    _ON_PG_CLOSE_COMPLETE ( data ) {
        this.#sth.portalClosed = true;
    }

    _ON_PG_PORTAL_SUSPENDED ( data ) {
        this.#sth.portalSuspended = true;
    }

    _ON_PG_NOTICE_RESPONSE ( data ) {
        var error = {};

        for ( const field of data.toString().split( "\0" ) ) {
            if ( !field ) continue;

            error[ERROR_RESPONSE_TYPE[field.charAt( 0 )]] = field.substr( 1 );
        }

        console.error( error.message + error.hint ? ", " + error.hint : "" );
    }

    // QUERY
    async do ( query, params, options ) {
        if ( !options ) options = {};

        // make compatible with sqlite
        options.ignoreData = true;

        return new Promise( ( resolve ) => {
            this._exec( resolve, query, params, options );
        } );
    }

    async selectAll ( query, params, options ) {
        if ( !options ) options = {};

        return new Promise( ( resolve ) => {
            this._exec( resolve, query, params, options );
        } );
    }

    async selectRow ( query, params, options ) {
        if ( !options ) options = {};

        options.maxRows = 1;

        return new Promise( ( resolve ) => {
            const onFinish = ( res ) => {
                if ( res.data ) res.data = res.data[0];

                resolve( res );
            };

            this._exec( onFinish, query, params, options );
        } );
    }

    _exec ( resolve, query, params, options ) {

        // dbh is already destroyed
        if ( this.#isDestroyed ) {
            resolve( res( [500, "Dbh is disconnected"] ) );

            return;
        }

        query = this._prepareQuery( query, params );

        const queryId = query[2];

        var sth = {
            resolve,
            "id": queryId,
            "query": query[0],
            options,
            "error": null,
            "parseComplete": false,
            "columns": null,
            "data": [],
        };

        // use simple query if query has no params, query is not prepared, no maxRows defined
        const useSimpleQuery = !( query[1] || queryId || options.maxRows );

        // for simple query multiple queries in single statement are allowed
        if ( useSimpleQuery ) {
            this._push( FRONTEND.QUERY, Buffer.from( sth.query + "\0", "utf8" ) );
        }

        // extended query mode
        else {
            const portalId = ""; // uuidv1(), currently we use unnamed portals

            // query is prepared
            if ( queryId ) {
                if ( !this.#prepared[queryId] ) {
                    this.#prepared[queryId] = {};
                }
                else {
                    sth.parseComplete = this.#prepared[queryId].parseComplete;
                    sth.columns = this.#prepared[queryId].columns;
                }
            }

            // parse query
            if ( !sth.parseComplete ) {
                this._push( FRONTEND.PARSE, Buffer.from( queryId + "\0" + sth.query + "\0\0\0" ) );
            }

            const paramsVals = [];

            // prepare params
            if ( query[1] ) {

                // create number of params
                const num = Buffer.alloc( 2 );
                num.writeUInt16BE( query[1].length );
                paramsVals.push( num );

                for ( let param of query[1] ) {

                    // null or undefined
                    if ( param == null ) {
                        paramsVals.push( PARAM_NULL );
                    }
                    else {

                        // parameter is tagged with type
                        if ( param[SQL_TYPE] ) param = TYPES.to[param[SQL_TYPE]]( param );

                        // string, utf8
                        if ( typeof param === "string" ) {
                            param = Buffer.from( param, "utf8" );
                        }

                        // number
                        else if ( typeof param === "number" ) {
                            param = Buffer.from( "" + param, "binary" );
                        }

                        // boolean
                        else if ( typeof param === "boolean" ) {
                            param = param ? PARAM_TRUE : PARAM_FALSE;
                        }

                        // buffer
                        else if ( Buffer.isBuffer( param ) ) {
                            param = "\\x" + Buffer.toString( "hex" );
                        }

                        // date
                        else if ( util.types.isDate( param ) ) {
                            param = Buffer.from( param.toISOString(), "binary" );
                        }

                        // error
                        else {
                            throw Error( `Unsupported SQL parameter type "${param}"` );
                        }

                        // create param length
                        const length = Buffer.alloc( 4 );
                        length.writeUInt32BE( param.length );

                        // push length + param
                        paramsVals.push( length, param );
                    }
                }
            }

            // no params
            else {
                paramsVals.push( PARAM_FORMAT_TEXT );
            }

            // bind, create portal
            this._push( FRONTEND.BIND, Buffer.concat( [Buffer.from( portalId + "\0" + queryId + "\0" ), PARAM_FORMAT_TEXT, ...paramsVals, ZERO, ZERO] ) );

            // request portal description
            if ( !sth.columns ) {
                this._push( FRONTEND.DESCRIBE, Buffer.from( FRONTEND.CLOSE_PORTAL + portalId + "\0" ) );
            }

            // prepare maxRows buffer
            let maxRowsBuf;

            if ( !options.maxRows ) {
                maxRowsBuf = UINT32BE_0;
            }
            else if ( options.maxRows === 1 ) {
                maxRowsBuf = UINT32BE_1;
            }
            else {
                maxRowsBuf = Buffer.alloc( 4 );

                maxRowsBuf.writeUInt32BE( options.maxRows );
            }

            // execute
            this._push( FRONTEND.EXECUTE, Buffer.concat( [Buffer.from( portalId + "\0" ), maxRowsBuf] ) );

            // close portal if maxRows was used
            if ( options.maxRows ) {
                this._push( FRONTEND.CLOSE, Buffer.from( FRONTEND.CLOSE_PORTAL + portalId + "\0" ) );
            }

            // flush
            this._push( FRONTEND.FLUSH );

            // sync
            this._push( FRONTEND.SYNC );
        }

        if ( !this.#sth ) {
            this.#sth = sth;
        }
        else {
            this.#queue.push( sth );
        }

        this._send();
    }

    _prepareQuery ( query, params ) {

        // query object
        if ( this.isQuery( query ) ) {
            query = query.getQuery( true );

            // override params
            if ( params ) query[1] = params;

            if ( !query[1].length ) query[1] = null;
        }

        // query is string
        else {

            // convert placeholders from "?" to "$1", only if query passed as string and has params
            if ( params ) {
                let n = 0;

                query = query.replace( /\?/g, () => "$" + ++n );
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
