import "#lib/result";
import { DBHPool } from "../dbh.js";
import SQLite from "@softvisio/sqlite";
import * as uuid from "#lib/uuid";
import crypto from "crypto";
import { Where as _Where, Query as _Query, SQL } from "../query.js";
import { DEFAULT_TYPES_SQLITE } from "../types.js";
import _url from "url";

const MAX_PARAMS = 999;
const MIN_BIGINT = -9223372036854775808n;
const MAX_BIGINT = 9223372036854775807n;
const MIN_BIGINT_NUMBER = BigInt( Number.MIN_SAFE_INTEGER );
const MAX_BIGINT_NUMBER = BigInt( Number.MAX_SAFE_INTEGER );

const DEFAULT_READONLY = false;
const DEFAULT_CREATE = true;
const DEFAULT_BUSY_TIMEOUT = 3000; // ms, 3 sec.
const DEFAULT_TEMP_STORE = "memory";
const DEFAULT_JOURNAL_MODE = "wal";
const DEFAULT_SYNCHRONOUS = "off";
const DEFAULT_CACHE_SIZE = -1_048_576; // 1G
const DEFAULT_FOREIGN_KEYS = true;

// NOTE https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md

class Where extends _Where {

    // in sqlite LIKE operator is case-insensitive by default (PRAGMA case_sensitive_like = true)
    get _likeOperator () {
        return "LIKE";
    }
}

class Query extends _Query {

    // in sqlite LIKE operator is case-insensitive by default (PRAGMA case_sensitive_like = true)
    get _likeOperator () {
        return "LIKE";
    }
}

export default class DBHPoolSQLite extends DBHPool {
    #url;
    #pathname;

    #readOnly;
    #create;
    #busyTimeout;
    #tempStore; // FILE, MEMORY
    #journalMode; // DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF. WAL is the best
    #synchronous; // [FULL, NORMAL, OFF], OFF - data integrity on app failure, NORMAL - data integrity on app and OS failures, FULL - full data integrity on app or OS failures, slower
    #cacheSize; // Int, 0+ - pages,  -kilobytes, default 1G
    #foreignKeys;

    #sqlite;
    #prepared = {};

    #types = { ...DEFAULT_TYPES_SQLITE.types };
    #encode = { ...DEFAULT_TYPES_SQLITE.encode };
    #decode = { ...DEFAULT_TYPES_SQLITE.decode };

    constructor ( url, options = {} ) {
        super( url, options );

        // readOnly
        this.#readOnly = options.readOnly ?? ( url.searchParams.get( "readOnly" ) || DEFAULT_READONLY );
        this.#readOnly = this.#readOnly === true || this.#readOnly === "true";

        // create
        this.#create = options.create ?? ( url.searchParams.get( "create" ) || DEFAULT_CREATE );
        this.#create = this.#create === true || this.#create === "true";

        // busyTimeout
        this.#busyTimeout = options.busyTimeout ?? ( url.searchParams.get( "busyTimeout" ) || DEFAULT_BUSY_TIMEOUT );
        this.#busyTimeout = +this.#busyTimeout;
        if ( isNaN( this.#busyTimeout ) ) this.#busyTimeout = DEFAULT_BUSY_TIMEOUT;

        // tempStore
        this.#tempStore = options.tempStore ?? ( url.searchParams.get( "tempStore" ) || DEFAULT_TEMP_STORE );

        // journalMode
        this.#journalMode = options.journalMode ?? ( url.searchParams.get( "journalMode" ) || DEFAULT_JOURNAL_MODE );

        // synchronous
        this.#synchronous = options.synchronous ?? ( url.searchParams.get( "synchronous" ) || DEFAULT_SYNCHRONOUS );

        // cacheSize
        this.#cacheSize = options.cacheSize ?? ( url.searchParams.get( "cacheSize" ) || DEFAULT_CACHE_SIZE );
        this.#cacheSize = +this.#cacheSize;
        if ( isNaN( this.#cacheSize ) ) this.#cacheSize = DEFAULT_CACHE_SIZE;

        // foreignKeys
        this.#foreignKeys = options.foreignKeys ?? ( url.searchParams.get( "foreignKeys" ) || DEFAULT_FOREIGN_KEYS );
        this.#foreignKeys = this.#foreignKeys === true || this.#foreignKeys === "true";

        if ( url.protocol === "file:" ) this.#pathname = _url.fileURLToPath( url );
        else this.#pathname = url.pathname;

        // in-memory database
        if ( this.#pathname === "/" || this.#pathname === "" ) this.#pathname = null;

        this.#sqlite = new SQLite( this.#pathname ?? ":memory:", {
            "readonly": this.#readOnly,
            "fileMustExist": !this.#create,
            "timeout": this.#busyTimeout,
        } );

        this.#sqlite.defaultSafeIntegers( true );

        this.#sqlite.pragma( `encoding = "UTF-8"` );
        this.#sqlite.pragma( `temp_store = ${this.#tempStore}` );
        this.#sqlite.pragma( `journal_mode = ${this.#journalMode}` );
        this.#sqlite.pragma( `synchronous = ${this.#synchronous}` );
        this.#sqlite.pragma( `cache_size = ${this.#cacheSize}` );
        this.#sqlite.pragma( `foreign_keys = ${this.#foreignKeys ? 1 : 0}` );

        // create custom functions
        this.#sqlite.function( "sqlite_notify", ( name, data ) => {
            process.nextTick( () => this.emit( "event/" + name, data ) );
        } );

        this.#sqlite.function( "uuid_generate_v4", () => {
            return uuid.v4();
        } );

        this.#sqlite.function( "gen_random_uuid", () => {
            return uuid.v4();
        } );

        this.#sqlite.function( "md5", str => {
            if ( str == null ) return null;

            return crypto.createHash( "MD5" ).update( str ).digest( "hex" );
        } );

        this.#sqlite.function( "time_hires", () => {
            return new Date().getTime() / 1000;
        } );
    }

    // properties
    get isSQLite () {
        return true;
    }

    get url () {
        if ( !this.#url ) {
            const url = new URL( "sqlite:" + ( this.#pathname ?? "" ) );

            if ( this.#readOnly !== DEFAULT_READONLY ) url.searchParams.set( "readOnly", this.#readOnly );
            if ( this.#create !== DEFAULT_CREATE ) url.searchParams.set( "create", this.#create );
            if ( this.#busyTimeout !== DEFAULT_BUSY_TIMEOUT ) url.searchParams.set( "busyTimeout", this.#busyTimeout );
            if ( this.#tempStore !== DEFAULT_TEMP_STORE ) url.searchParams.set( "tempStore", this.#tempStore );
            if ( this.#journalMode !== DEFAULT_JOURNAL_MODE ) url.searchParams.set( "journalMode", this.#journalMode );
            if ( this.#synchronous !== DEFAULT_SYNCHRONOUS ) url.searchParams.set( "synchronous", this.#synchronous );
            if ( this.#cacheSize !== DEFAULT_CACHE_SIZE ) url.searchParams.set( "cacheSize", this.#cacheSize );
            if ( this.#foreignKeys !== DEFAULT_FOREIGN_KEYS ) url.searchParams.set( "foreignKeys", this.#foreignKeys );

            url.searchParams.sort();

            this.#url = url.href;
        }

        return this.#url;
    }

    get sqlite () {
        return this.#sqlite;
    }

    get inTransaction () {
        return this.#sqlite.inTransaction;
    }

    get types () {
        return this.#types;
    }

    // public
    toString () {
        return this.url;
    }

    toJSON () {
        return this.url;
    }

    where ( ...args ) {
        return new Where( args );
    }

    sql () {
        return new Query().sql( ...arguments );
    }

    quote ( param ) {

        // param is tagged with the type
        if ( param != null && typeof param === "object" && param[Symbol.for( "SQLType" )] ) param = this.#encode[param[Symbol.for( "SQLType" )]]( param );

        // null
        if ( param == null ) {
            return "NULL";
        }
        else {

            // string
            if ( typeof param === "string" ) {

                // if value contains ZERO character
                // ignore, to make it comatible with postgres, where 0x00 in strings is disabled
                // if ( param.indexOf( "\0" ) > -1 ) {
                //     return "CAST(x'" + Buffer.from( param ).toString( "hex" ) + "' AS TEXT)";
                // }
                // else {
                return "'" + param.replace( /'/g, "''" ) + "'";

                // }
            }

            // number
            else if ( typeof param === "number" ) {
                return param;
            }

            // boolean
            else if ( typeof param === "boolean" ) {
                return param === true ? "TRUE" : "FALSE";
            }

            // bigint
            else if ( typeof param === "bigint" ) {
                if ( param < MIN_BIGINT || param > MAX_BIGINT ) throw Error( `BigInt number must be between ${MIN_BIGINT} and ${MAX_BIGINT}` );

                return param.toString();
            }

            // object
            else if ( typeof param === "object" ) {

                // buffer
                if ( Buffer.isBuffer( param ) ) {
                    return "x'" + param.toString( "hex" ) + "'";
                }

                // date
                else if ( param instanceof Date ) {
                    return "'" + param.toISOString() + "'";
                }

                // object
                else {
                    return "'" + JSON.stringify( param ).replace( /'/g, "''" ) + "'";
                }
            }

            // invalid type
            else {
                throw Error( `Unsupported SQL parameter type "${param}"` );
            }
        }
    }

    attach ( name, path ) {
        if ( path instanceof URL ) path = _url.fileURLToPath( path );
        else if ( path.startsWith( "file:" ) ) path = _url.fileURLToPath( path );

        // in-memory database
        if ( path === "/" || path === "" ) path = ":memory:";

        this.do( `ATTACH DATABASE '${path}' AS "${name}"` );

        this.#sqlite.pragma( `${name}.encoding = "UTF-8"` );
        this.#sqlite.pragma( `${name}.temp_store = ${this.#tempStore}` );
        this.#sqlite.pragma( `${name}.journal_mode = ${this.#journalMode}` );
        this.#sqlite.pragma( `${name}.synchronous = ${this.#synchronous}` );
        this.#sqlite.pragma( `${name}.cache_size = ${this.#cacheSize}` );
        this.#sqlite.pragma( `${name}.foreign_keys = ${this.#foreignKeys ? 1 : 0}` );
    }

    // pool
    _getDBH ( forTransaction ) {
        return this;
    }

    // query
    async exec ( query, params ) {
        const sth = this.#prepareQuery( query, params, true );

        var res;

        try {
            this.#sqlite.exec( sth.query );

            res = result( 200 );
        }
        catch ( e ) {
            res = this._onQueryError( e, sth.query );
        }

        return res;
    }

    async do ( query, params ) {
        const res = this.#do( query, params, false, true );

        return res;
    }

    async select ( query, params ) {
        const res = this.#do( query, params );

        return res;
    }

    async selectRow ( query, params ) {
        const res = this.#do( query, params, true );

        return res;
    }

    #do ( query, params, firstRow, ignoreData ) {
        query = this.#prepareQuery( query, params );

        var sth, decode;

        // query is prepared
        if ( query.id && this.#prepared[query.id] ) {
            sth = this.#prepared[query.id].sth;
            decode = this.#prepared[query.id].decode;
        }

        // sth is not cached
        if ( !sth ) {

            // prepare sth
            try {
                sth = this.#sqlite.prepare( query.query );
            }
            catch ( e ) {
                return this._onQueryError( e, query.query );
            }

            if ( sth.reader ) {
                let _decode;

                for ( const column of sth.columns() ) {
                    let type;

                    if ( query.types?.[column.name] ) {
                        type = query.types[column.name];

                        // invalid column decode type
                        if ( !this.#decode[type] ) return this._onQueryError( Error( `Invalid decode type for column "${column.name}"` ), query.query );
                    }
                    else {
                        type = column.type;
                    }

                    if ( type && this.#decode[type] ) {
                        _decode ||= {};

                        _decode[column.name] = this.#decode[type];
                    }
                }

                if ( _decode ) decode = _decode;
            }

            // cache sth
            if ( query.id ) {
                this.#prepared[query.id] = {
                    sth,
                    decode,
                };
            }
        }

        // check correct dbh method usage
        if ( ignoreData ) {
            if ( sth.reader ) throw `Invalid usage, you need to execute query, that returns data, using "select" method, ` + query.query;
        }
        else if ( !sth.reader ) throw `Invalid usage, you need to execute query, that returns no data, using "do" method, ` + query.query;

        ignoreData ||= !sth.reader;

        try {
            let data, res;

            const method = ignoreData ? "run" : firstRow ? "get" : "all";

            if ( query.params ) {
                data = sth[method]( this.#prepareParams( query.params ) );
            }
            else {
                data = sth[method]();
            }

            // "do" request
            if ( ignoreData ) {
                res = result( 200, null );

                res.rows = data.changes;
            }

            // "select" request
            else {
                res = result( 200 );

                if ( !firstRow && !data.length ) data = null;

                if ( data ) {
                    if ( firstRow ) data = [data];

                    // decode columns
                    for ( const row of data ) {
                        for ( const name in row ) {
                            if ( row[name] == null ) continue;

                            // decode with column decoder
                            if ( decode?.[name] ) {
                                row[name] = decode[name]( row[name] );
                            }

                            // decode bigint
                            else if ( typeof row[name] === "bigint" ) {

                                // bigint is too big for number
                                if ( row[name] < MIN_BIGINT_NUMBER || row[name] > MAX_BIGINT_NUMBER ) {
                                    throw Error( `BigInt in column "${name}" is too big for Number` );
                                }

                                // safe to decode bigint to number
                                row[name] = Number( row[name] );
                            }
                        }
                    }

                    res.rows = data.length;

                    if ( firstRow ) data = data[0];

                    res.data = data;
                }
                else {
                    res.rows = 0;
                }
            }

            return res;
        }
        catch ( e ) {
            return this._onQueryError( e, query.query );
        }
    }

    #prepareQuery ( query, params, toString ) {
        var sth;

        // query object
        if ( query instanceof SQL ) {
            sth = {
                "id": query.id,
                "query": query.query,
                "params": params || query.params,
                "types": query.types,
            };

            if ( !sth.params.length ) sth.params = null;
        }

        // query is string
        else {
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

    #prepareParams ( params ) {
        const _params = [];

        for ( let param of params ) {

            // param is tagged with the type
            if ( param != null && typeof param === "object" && param[Symbol.for( "SQLType" )] ) param = this.#encode[param[Symbol.for( "SQLType" )]]( param );

            // null
            if ( param == null ) {
                _params.push( null );
            }
            else {
                if ( typeof param === "boolean" ) {
                    _params.push( param === true ? 1 : 0 );
                }

                // object
                else if ( typeof param === "object" ) {

                    // date
                    if ( param instanceof Date ) {
                        _params.push( param.toISOString() );
                    }

                    // object
                    else {
                        _params.push( JSON.stringify( param ) );
                    }
                }

                // add as is
                else {
                    _params.push( param );
                }
            }
        }

        return _params;
    }

    // types
    addType ( name, { encode, decode } ) {
        if ( encode ) {
            this.#types[name] = function ( value ) {
                if ( value != null && typeof value === "object" ) value[Symbol.for( "SQLType" )] = name;

                return value;
            };

            this.#encode[name] = encode;
        }

        if ( decode ) this.#decode[name] = decode;

        return result( 200 );
    }

    // notifications
    get isReady () {
        return true;
    }

    waitReady () {
        return;
    }
}
