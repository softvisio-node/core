import "#lib/result";
import { DbhPool } from "../dbd.js";
import Sqlite from "@softvisio/sqlite";
import { v1 as uuidv1, v4 as uuidv4 } from "uuid";
import crypto from "crypto";
import { Where, Query } from "../dbi.js";
import { DEFAULT_TYPES_SQLITE } from "../types.js";
import _url from "url";

import CONST from "#lib/const";

const MAX_PARAMS = 999;

const DEFAULT_READONLY = false;
const DEFAULT_CREATE = true;
const DEFAULT_BUSY_TIMEOUT = 3000;
const DEFAULT_TEMP_STORE = "MEMORY";
const DEFAULT_JOURNAL_MODE = "WAL";
const DEFAULT_SYNCHRONOUS = "OFF";
const DEFAULT_CACHE_SIZE = -1_048_576;
const DEFAULT_FOREIGN_KEYS = true;

// NOTE https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md

class DbdWhere extends Where {

    // in sqlite LIKE operator is case-insensitive by default (PRAGMA case_sensitive_like = true)
    get _likeOperator () {
        return "LIKE";
    }
}

class DbdQuery extends Query {

    // in sqlite LIKE operator is case-insensitive by default (PRAGMA case_sensitive_like = true)
    get _likeOperator () {
        return "LIKE";
    }
}

export default class DbhPoolSqlite extends DbhPool {
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

    #dbh;
    #prepared = {};
    #lastInsertRowId;

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
        if ( this.#pathname === "/" || this.#pathname === "" ) this.#pathname = null;

        this.#dbh = new Sqlite( this.#pathname ?? ":memory:", {
            "readonly": this.#readOnly,
            "fileMustExist": !this.#create,
            "timeout": this.#busyTimeout,
        } );

        this.#dbh.defaultSafeIntegers( true );

        this.#dbh.pragma( `encoding = "UTF-8"` );
        this.#dbh.pragma( `temp_store = ${this.#tempStore}` );
        this.#dbh.pragma( `journal_mode = ${this.#journalMode}` );
        this.#dbh.pragma( `synchronous = ${this.#synchronous}` );
        this.#dbh.pragma( `cache_size = ${this.#cacheSize}` );
        this.#dbh.pragma( `foreign_keys = ${this.#foreignKeys ? 1 : 0}` );

        // create custom functions
        this.#dbh.function( "sqlite_notify", ( name, data ) => {
            process.nextTick( () => this.emit( "event/" + name, data ) );
        } );

        this.#dbh.function( "uuid_generate_v1", () => {
            return uuidv1();
        } );

        this.#dbh.function( "uuid_generate_v1mc", () => {
            return uuidv1();
        } );

        this.#dbh.function( "uuid_generate_v4", () => {
            return uuidv4();
        } );

        this.#dbh.function( "gen_random_uuid", () => {
            return uuidv4();
        } );

        this.#dbh.function( "md5", str => {
            if ( str == null ) return null;

            return crypto.createHash( "MD5" ).update( str ).digest( "hex" );
        } );

        this.#dbh.function( "time_hires", () => {
            return new Date().getTime() / 1000;
        } );
    }

    // properties
    get isSqlite () {
        return true;
    }

    get type () {
        return "sqlite";
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

    get db () {
        return this.#dbh;
    }

    get inTransaction () {
        return this.#dbh.inTransaction;
    }

    get lastInsertRowId () {
        return this.#lastInsertRowId;
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

    WHERE ( ...args ) {
        return new DbdWhere( args );
    }

    sql () {
        return new DbdQuery().sql( ...arguments );
    }

    quote ( param ) {

        // null
        if ( param == null ) {
            return "NULL";
        }
        else {

            // param is tagged with the type
            if ( param[CONST.SQL_TYPE] ) param = this.#encode[param[CONST.SQL_TYPE]]( param );

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
                if ( param < -9223372036854775808n || param > 9223372036854775807n ) throw Error( `BigInt number must be between -9223372036854775808n and 9223372036854775807n` );

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

        this.do( `ATTACH DATABASE '${path || ":memory:"}' AS "${name}"` );

        this.#dbh.pragma( `${name}.encoding = "UTF-8"` );
        this.#dbh.pragma( `${name}.temp_store = ${this.#tempStore}` );
        this.#dbh.pragma( `${name}.journal_mode = ${this.#journalMode}` );
        this.#dbh.pragma( `${name}.synchronous = ${this.#synchronous}` );
        this.#dbh.pragma( `${name}.cache_size = ${this.#cacheSize}` );
        this.#dbh.pragma( `${name}.foreign_keys = ${this.#foreignKeys ? 1 : 0}` );
    }

    // pool
    _getDbh ( forTransaction ) {
        return this;
    }

    // query
    async exec ( query, params ) {
        query = this.#prepareQuery( query, params, true );

        var res;

        try {
            this.#dbh.exec( query[0] );

            res = result( 200 );
        }
        catch ( e ) {
            res = this._onQueryError( e, query[0] );
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

        var queryId = query[2],
            sth,
            decode;

        // query is prepared
        if ( queryId && this.#prepared[queryId] ) {
            sth = this.#prepared[queryId].sth;
            decode = this.#prepared[queryId].decode;
        }

        // sth is not cached
        if ( !sth ) {

            // prepare sth
            try {
                sth = this.#dbh.prepare( query[0] );
            }
            catch ( e ) {
                return this._onQueryError( e, query[0] );
            }

            if ( sth.reader ) {
                let _decode;
                const columns = {};

                for ( const column of sth.columns() ) {
                    let type = ( query[3] && query[3][column.name] ) || column.type;

                    if ( type ) {
                        type = type.toLowerCase();

                        if ( this.#decode[type] ) {
                            _decode = true;

                            columns[column.name] = this.#decode[type];
                        }
                    }
                }

                if ( _decode ) decode = columns;
            }

            // cache sth
            if ( queryId ) {
                this.#prepared[queryId] = {
                    sth,
                    decode,
                };
            }
        }

        // check correct dbh method usage
        if ( ignoreData ) {
            if ( sth.reader ) throw `Invalid usage, you need to execute query, that returns data, using "select" method, ` + query[0];
        }
        else if ( !sth.reader ) throw `Invalid usage, you need to execute query, that returns no data, using "do" method, ` + query[0];

        ignoreData ||= !sth.reader;

        try {
            let data, res;

            const method = ignoreData ? "run" : firstRow ? "get" : "all";

            if ( query[1] ) {
                data = sth[method]( this.#prepareParams( query[1] ) );
            }
            else {
                data = sth[method]();
            }

            // "do" request
            if ( ignoreData ) {
                this.#lastInsertRowId = data.lastInsertRowid;

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
                            if ( decode && decode[name] ) row[name] = decode[name]( row[name] );

                            // decode BigInt
                            // if ( typeof row[name] === "bigint" ) {

                            // decode BigInt to Number, data can be lost
                            // row[name] = Number( row[name] );

                            // decode safe BigInt to Number, unsafe to String
                            // if ( row[name] < Number.MIN_SAFE_INTEGER || row[name] > Number.MAX_SAFE_INTEGER ) row[name] = row[name].toString();
                            // else row[name] = Number( row[name] );
                            // }
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
            return this._onQueryError( e, query[0] );
        }
    }

    #prepareQuery ( query, params, toString ) {

        // query object
        if ( this.isQuery( query ) ) {
            query = query.getQuery( false );

            // override params
            if ( params ) query[1] = params;

            if ( !query[1].length ) query[1] = null;
        }

        // query is string
        else {
            query = [query, params, null, null];
        }

        // serialize query if number of params exceeded
        if ( query[1] && ( toString || query[1].length > MAX_PARAMS ) ) {
            return [this.queryToString( query[0], query[1] ), null, "", query[3]];
        }
        else {
            return query;
        }
    }

    #prepareParams ( params ) {
        return params.map( param => {

            // null
            if ( param == null ) {
                return null;
            }
            else {

                // param is tagged with the type
                if ( param[CONST.SQL_TYPE] ) param = this.#encode[param[CONST.SQL_TYPE]]( param );

                if ( typeof param === "boolean" ) {
                    return param === true ? 1 : 0;
                }

                // date
                else if ( typeof param === "object" ) {

                    // date
                    if ( param instanceof Date ) {
                        return param.toISOString();
                    }

                    // object
                    else {
                        return JSON.stringify( param );
                    }
                }

                // return as is
                else {
                    return param;
                }
            }
        } );
    }

    // types
    async addType ( { name, encode, decode } ) {
        if ( encode ) {
            this.#types[name] = function ( value ) {
                if ( value != null && typeof value === "object" ) value[CONST.SQL_TYPE] = name;

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

    async waitReady () {
        return;
    }
}
