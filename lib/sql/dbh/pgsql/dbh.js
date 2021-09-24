import "#lib/result";
import { DBH } from "#lib/sql/dbh";
import net from "net";
import crypto from "crypto";
import { SQL } from "#lib/sql/query";
import TransactionsAsync from "#lib/sql/transactions-async";
import MessageBuffer from "./message-buffer.js";

const PROTOCOL_VERSION = Buffer.from( [0x00, 0x03, 0x00, 0x00] ); // v3
const MAX_PARAMS = 65535;

// FRONTEND MESSAGES
const FRONTEND = {
    "BIND": "B",
    "CANCEL_REQUEST": "",
    "CLOSE": "C",
    "CLOSE_STATEMENT": "S",
    "CLOSE_PORTAL": "P",
    "DESCRIBE": "D",
    "DESCRIBE_STATEMENT": "S",
    "DESCRIBE_PORTAL": "P",
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

const BACKEND_METHOD = Object.fromEntries( Object.keys( BACKEND ).map( key => [BACKEND[key], "_ON_PG_" + key] ) );

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

const messageBuffer = new MessageBuffer();

export default class DBHPgSQL extends TransactionsAsync( DBH ) {
    #pool;

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

    constructor ( pool ) {
        super();

        this.#pool = pool;

        this.#connect();
    }

    get isPgSQL () {
        return true;
    }

    get url () {
        return this.#pool.url;
    }

    get inTransaction () {
        return TRANSACTION_STATE[this.#transactionState];
    }

    get isDestroyed () {
        return this.#isDestroyed;
    }

    // public
    toString () {
        return this.url;
    }

    toJSON () {
        return this.url;
    }

    where () {
        return this.#pool.where( ...arguments );
    }

    sql () {
        return this.#pool.sql( ...arguments );
    }

    quote ( value ) {
        return this.#pool.quote( value );
    }

    destroy ( res ) {
        if ( this.#isDestroyed ) return;

        this.#isDestroyed = true;
        this.#isConnected = false;

        // cleanup socket
        this.#socket.removeAllListeners();
        this.#socket = null;

        // create result
        if ( !res ) res = result.exception( [500, "DBH is disconnected"] );
        else res.exception = true;

        // cleanup queue
        var queue = this.#queue;

        this.#queue = [];

        // finish current request
        this.#finishRequest( res );

        // finish all pending requests
        for ( const sth of queue ) {
            sth.resolve( res );
        }

        this.emit( "destroy", this );
    }

    #send ( buf ) {
        if ( !this.#isConnected ) {
            this.#wbuf.push( buf );
        }
        else {
            this.#socket.write( buf );
        }
    }

    #connect () {
        this.#socket = this.#pool.hostname === "unix" ? net.connect( this.#pool.socket ) : net.connect( this.#pool.port, this.#pool.hostname );

        this.#socket.setKeepAlive( true, 60000 );

        this.#socket.once( "connect", this.#onConnect.bind( this ) );

        this.#socket.on( "data", this.#onData.bind( this ) );

        this.#socket.once( "close", hadError => this.destroy( result( [500, "DBH is disconnected"] ) ) );

        this.#socket.once( "error", e => this.destroy( result( [500, e.message] ) ) );
    }

    #onConnect () {
        var params = {
            "user": this.#pool.username,
            "database": this.#pool.database,
            "options": "--client-min-messages=warning",
            "replication": "false",

            // session run-time params
            "client_encoding": "UTF8",
            "bytea_output": "hex",
            "backslash_quote": "off",
            "standard_conforming_strings": "on",
        };

        const msg = messageBuffer.beginMsg( FRONTEND.STARTUP_MESSAGE ).add( PROTOCOL_VERSION );

        Object.keys( params ).forEach( param => msg.str( param + "\0" + params[param] + "\0" ) );

        this.#socket.write( msg.z( 1 ).endMsg().get() );
    }

    #finishRequest ( res ) {
        var sth = this.#sth;

        if ( !sth ) return;

        this.#sth = this.#queue.shift();

        // compose result
        if ( !res ) {
            if ( sth.error ) {
                res = this._onQueryError( sth.error, sth.query, sth.error.position );
            }
            else {
                const columns = sth.id ? this.#prepared[sth.id].columns : sth.columns;

                // check correct dbh method usage
                if ( sth.options.ignoreData ) {

                    // query returns
                    if ( columns ) {
                        throw `Invalid usage, you need to execute query, that returns data, using "select" method, ` + sth.query;
                    }
                }

                // query returns no data
                else if ( !columns ) {
                    throw `Invalid usage, you need to execute query, that returns no data, using "do" method, ` + sth.query;
                }

                res = result( 200, sth.data.length ? sth.data : null );

                if ( typeof sth.rows !== "undefined" ) res.rows = sth.rows;
            }
        }

        sth.resolve( res );
    }

    // XXX slice
    #onData ( data ) {
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

    // postgres message handlers
    _ON_PG_AUTHENTICATION ( data ) {
        var type = data.readUInt32BE();

        if ( type === BACKEND.AUTHENTICATION_OK ) {

            // auth is ok
        }
        else if ( type === BACKEND.AUTHENTICATION_CLEARTEXT_PASSWORD ) {
            this.#socket.write( messageBuffer
                .beginMsg( FRONTEND.PASSWORD_MESSAGE )
                .str( this.#pool.password ?? "" )
                .z( 1 )
                .endMsg()
                .get() );
        }
        else if ( type === BACKEND.AUTHENTICATION_MD5_PASSWORD ) {
            const pwdhash = crypto
                .createHash( "MD5" )
                .update( ( this.#pool.password ?? "" ) + this.#pool.username, "utf8" )
                .digest( "hex" );

            const hash =
                "md5" +
                crypto
                    .createHash( "MD5" )
                    .update( pwdhash + data.slice( 4 ).toString( "binary" ), "binary" )
                    .digest( "hex" );

            this.#socket.write( messageBuffer.beginMsg( FRONTEND.PASSWORD_MESSAGE ).str( hash ).z( 1 ).endMsg().get() );
        }
        else {
            this.destroy( result( [500, "Unsupported authentication method"] ) );
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

    // ready for query
    _ON_PG_READY_FOR_QUERY ( data ) {
        this.#transactionState = data.toString();

        // dbh is connected
        if ( !this.#isConnected ) {
            this.#isConnected = true;

            // send pending messages
            if ( this.#wbuf.length ) {
                if ( this.#wbuf.length === 1 ) {
                    this.#socket.write( this.#wbuf[0] );
                }
                else {
                    this.#socket.write( Buffer.concat( this.#wbuf ) );
                }

                this.#wbuf = [];
            }
        }

        // query is finished
        else {
            this.#finishRequest();
        }
    }

    // error response
    _ON_PG_ERROR_RESPONSE ( data ) {
        var error = {};

        // parse error message
        for ( const field of data.toString().split( "\0" ) ) {
            if ( !field ) continue;

            error[ERROR_RESPONSE_TYPE[field.charAt( 0 )]] = field.substr( 1 );
        }

        // error during connection
        if ( !this.#isConnected ) {
            this.destroy( result( [500, error.message] ) );
        }

        // query error
        else if ( this.#sth ) {
            this.#sth.error = error;
        }

        // unknown error
        else {
            this.destroy( result( [500, error.message] ) );
        }
    }

    _ON_PG_EMPTY_QUERY_RESPONSE ( data ) {

        // identifies the message as a response to an empty query string. (This substitutes for CommandComplete.)
        this._ON_PG_COMMAND_COMPLETE( data );
    }

    _ON_PG_ROW_DESCRIPTION ( data ) {
        var types = this.#sth.types,
            decoder,
            numOfCols = data.readInt16BE(),
            pos = 2,
            columns = [];

        for ( let n = 0; n < numOfCols; n++ ) {
            let idx = data.indexOf( "\0", pos );

            const column = [

                //
                data.toString( "binary", pos, idx ), // column name
                data.readInt32BE( ( idx += 1 ) ), // if the field can be identified as a column of a specific table, the object ID of the table; otherwise zero.
                data.readInt16BE( ( idx += 4 ) ), // if the field can be identified as a column of a specific table, the attribute number of the column; otherwise zero.
                data.readInt32BE( ( idx += 2 ) ), // the object ID of the field's data type.
                data.readInt16BE( ( idx += 4 ) ), // the data type size (see pg_type.typlen). Note that negative values denote variable-width types., -1 - indicates a "varlena" type (one that has a length word);, -2 - indicates a null-terminated C string;
                data.readInt32BE( ( idx += 2 ) ), // the type modifier (see pg_attribute.atttypmod). The meaning of the modifier is type-specific.
                data.readInt16BE( ( idx += 4 ) ), // the format code being used for the field. Currently will be 0 (text) or 1 (binary). In a RowDescription returned from the statement variant of Describe, the format code is not yet known and will always be zero.
            ];

            pos = idx + 2;

            // get decoder by column name
            if ( types && types[column[0]] ) {
                decoder = this.#pool.decode[types[column[0]]];

                if ( !decoder ) this.#sth.error = Error( `Invalid decode type for column "${column[0]}"` );
            }

            // get decoder by base type
            else if ( column[5] === -1 ) {
                decoder = this.#pool.decode[column[3]];
            }

            // get decoder by type mod. or by base type
            else {
                decoder = this.#pool.decode[column[3] + "/" + column[5]] || this.#pool.decode[column[3]];
            }

            // get type decoder
            column.push( decoder );

            columns.push( column );
        }

        this.#sth.columns = columns;

        // query is prepared, store columns descriptions
        if ( this.#sth.id ) this.#prepared[this.#sth.id].columns = columns;
    }

    _ON_PG_NO_DATA ( data ) {}

    _ON_PG_DATA_ROW ( data ) {

        // ignore data
        if ( this.#sth.options.ignoreData ) return;

        var numOfCols = data.readUInt16BE(),
            columns = this.#sth.prepared ? this.#prepared[this.#sth.id].columns : this.#sth.columns,
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
                const decoder = columns[n][7];

                // column has decoder
                if ( decoder ) {
                    col = decoder( data.slice( pos, ( pos += length ) ) );
                }

                // decode to utf8 string by default
                else {
                    col = data.toString( "utf8", pos, ( pos += length ) );
                }
            }

            row[columns[n][0]] = col;
        }

        this.#sth.data.push( row );
    }

    _ON_PG_COMMAND_COMPLETE ( data ) {
        const rowsTag = data.toString( "binary", 0, data.length - 1 );

        const rows = rowsTag.match( /\s(\d+)$/ );

        if ( rows ) this.#sth.rows = +rows[1];
    }

    _ON_PG_PARSE_COMPLETE ( data ) {}

    _ON_PG_BIND_COMPLETE ( data ) {}

    _ON_PG_CLOSE_COMPLETE ( data ) {}

    _ON_PG_PORTAL_SUSPENDED ( data ) {}

    _ON_PG_NOTICE_RESPONSE ( data ) {
        var error = {};

        for ( const field of data.toString().split( "\0" ) ) {
            if ( !field ) continue;

            error[ERROR_RESPONSE_TYPE[field.charAt( 0 )]] = field.substr( 1 );
        }

        console.log( "PgSQL notice:", error.severity, error.message + ( error.hint ? ", " + error.hint : "" ) );
    }

    _ON_PG_NOTIFICATION_RESPONSE ( data ) {

        // const pid = data.readInt32BE();

        const [channel, payload] = data.slice( 4 ).toString().split( "\0" );

        this.#pool.emit( "event/" + channel, payload );
    }

    // query
    async exec ( query, params ) {
        return new Promise( resolve => {
            this.#do( resolve, query, params, {
                "exec": true,
                "ignoreData": true,
            } );
        } );
    }

    async do ( query, params ) {
        return new Promise( resolve => {
            this.#do( resolve, query, params, {
                "ignoreData": true,
            } );
        } );
    }

    async select ( query, params ) {
        return new Promise( resolve => {
            this.#do( resolve, query, params, {} );
        } );
    }

    async selectRow ( query, params ) {
        return new Promise( resolve => {
            this.#do( res => {
                if ( res.data ) {
                    res.data = res.data[0];
                    res.rows = 1;
                }
                else {
                    res.rows = 0;
                }

                resolve( res );
            },
            query,
            params,
            {
                "maxRows": 1,
            } );
        } );
    }

    #do ( resolve, query, params, options ) {

        // dbh is already destroyed
        if ( this.#isDestroyed ) {
            resolve( result.exception( [500, "DBH is disconnected"] ) );

            return;
        }

        query = this.#prepareQuery( query, params, options.exec );

        var sth = {
            resolve,
            "id": query.id ?? "",
            "query": query.query,
            "types": query.types,
            options,
            "error": null,
            "prepared": false,
            "columns": null,
            "data": [],
        };

        // use simple query if query has no params, query is not prepared, no maxRows defined
        const useSimpleQuery = !( query.params || sth.id || options.maxRows );

        // for simple query multiple queries in single statement are allowed
        if ( useSimpleQuery ) {
            messageBuffer
                .beginMsg( FRONTEND.QUERY )
                .str( sth.query + "\0" )
                .endMsg();
        }

        // extended query mode
        else {
            const portalId = ""; // uuid.v4(), currently we use unnamed portals

            // query is prepared
            if ( sth.id ) {
                if ( !this.#prepared[sth.id] ) {
                    this.#prepared[sth.id] = {};
                }
                else {
                    sth.prepared = true;
                }
            }

            // parse query
            if ( !sth.prepared ) {
                messageBuffer
                    .beginMsg( FRONTEND.PARSE )
                    .str( sth.id + "\0" + sth.query + "\0\0\0" )
                    .endMsg();
            }

            // bind, create portal
            messageBuffer
                .beginMsg( FRONTEND.BIND )
                .str( portalId + "\0" + sth.id + "\0" )
                .i16( 0 ) // params format text
                .i16( query.params?.length ?? 0 ); // params length

            // prepare params
            if ( query.params ) {
                for ( let param of query.params ) {

                    // parameter is tagged with type
                    if ( param != null && typeof param === "object" && param[Symbol.for( "SQLType" )] ) param = this.#pool.encode[param[Symbol.for( "SQLType" )]]( param );

                    // null or undefined
                    if ( param == null ) {
                        messageBuffer.i32( -1 );
                    }
                    else {
                        if ( typeof param !== "string" ) {

                            // number
                            if ( typeof param === "number" ) {
                                param = param.toString();
                            }

                            // boolean
                            else if ( typeof param === "boolean" ) {
                                param = param ? "t" : "f";
                            }

                            // bigint
                            else if ( typeof param === "bigint" ) {
                                param = param.toString();
                            }

                            // object
                            else if ( typeof param === "object" ) {

                                // buffer
                                if ( Buffer.isBuffer( param ) ) {
                                    param = "\\x" + param.toString( "hex" );
                                }

                                // date
                                else if ( param instanceof Date ) {
                                    param = param.toISOString();
                                }

                                // object
                                else {
                                    param = JSON.stringify( param );
                                }
                            }

                            // error
                            else {
                                throw Error( `Unsupported SQL parameter type "${param}"` );
                            }
                        }

                        messageBuffer.i32( Buffer.byteLength( param ) ).str( param );
                    }
                }
            }

            // finish bind msg
            messageBuffer.z( 2 ).endMsg();

            // request portal description
            if ( !sth.prepared ) {
                messageBuffer
                    .beginMsg( FRONTEND.DESCRIBE )
                    .str( FRONTEND.DESCRIBE_PORTAL + portalId + "\0" )
                    .endMsg();
            }

            // execute
            messageBuffer
                .beginMsg( FRONTEND.EXECUTE )
                .str( portalId + "\0" )
                .i32( options.maxRows || 0 )
                .endMsg();

            // close portal if maxRows was used
            if ( options.maxRows ) {
                messageBuffer
                    .beginMsg( FRONTEND.CLOSE )
                    .str( FRONTEND.CLOSE_PORTAL + portalId + "\0" )
                    .endMsg();
            }

            // flush
            messageBuffer.beginMsg( FRONTEND.FLUSH ).endMsg();

            // sync
            messageBuffer.beginMsg( FRONTEND.SYNC ).endMsg();
        }

        if ( !this.#sth ) {
            this.#sth = sth;
        }
        else {
            this.#queue.push( sth );
        }

        this.#send( messageBuffer.get() );
    }

    #prepareQuery ( query, params, toString ) {
        var sth;

        // query object
        if ( query instanceof SQL ) {
            sth = {
                "id": query.id,
                "query": query.queryPgSQL,
                "params": params || query.params,
                "types": query.types,
            };

            if ( !sth.params.length ) sth.params = null;
        }

        // query is string
        else {

            // convert placeholders from "?" to "$1", only if query passed as string and has params
            if ( params ) {
                let n = 0;

                query = query.replace( /\?/g, () => "$" + ++n );
            }

            sth = { query, params };
        }

        // serialize query if number of params exceeded
        if ( sth.params && ( toString || sth.params.length > MAX_PARAMS ) ) {
            sth.query = this.queryToString( sth.query, sth.params );
            sth.id = null;
            sth.params = null;
        }

        return sth;
    }

    // types
    get types () {
        return this.#pool.types;
    }

    async addType ( name, { encode, decode } ) {
        var id;

        const res = await this.selectRow( `SELECT "oid", "typbasetype", "typtypmod" FROM "pg_type" WHERE "typname" = ?`, [name] );

        if ( !res.ok ) return res;

        // type is already registered
        if ( res.data ) {
            id = res.data.typtypmod === -1 ? res.data.oid : res.data.typbasetype + "/" + res.data.typtypmod;
        }

        if ( encode ) {
            this.#pool.types[name] = function ( value ) {
                if ( value != null && typeof value === "object" ) value[Symbol.for( "SQLType" )] = name;

                return value;
            };

            this.#pool.encode[name] = encode;
        }

        if ( decode ) {
            this.#pool.decode[name] = decode;

            if ( id ) this.#pool.decode[id] = decode;
        }

        return result( 200 );
    }

    // notifications
    get isReady () {
        return this.#pool.isReady;
    }

    async waitReady () {
        return this.#pool.waitReady();
    }

    // protected
    _getDBH () {
        return this;
    }
}
