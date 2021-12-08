import "#lib/result";
import Sqlite from "@softvisio/sqlite";
import * as uuid from "#lib/uuid";
import crypto from "crypto";
import { Where as _Where, Query as _Query, Sql } from "#lib/sql/query";
import { DEFAULT_TYPES_SQLITE } from "#lib/sql/types";
import _url from "url";
import Transactions from "./sqlite/transactions.js";
import Migration from "./sqlite/migration.js";
import sqlConst from "#lib/sql/const";

const MAX_PARAMS = 999;
const MIN_BIGINT = -9223372036854775808n;
const MAX_BIGINT = 9223372036854775807n;
const MIN_BIGINT_NUMBER = BigInt( Number.MIN_SAFE_INTEGER );
const MAX_BIGINT_NUMBER = BigInt( Number.MAX_SAFE_INTEGER );

const DEFAULT_CACHE = "private"; // "shared", "private"
const DEFAULT_MODE = "rwc"; // "ro", "rw", "rwc", "memory"
const DEFAULT_TEMP_STORE = "memory"; // "file", "memory"
const DEFAULT_JOURNAL_MODE = "wal"; // "delete", "truncate", "persist", "memory", "wal", "off". "wal" is the best.
const DEFAULT_SYNCHRONOUS = "off"; // "full", "normal", "off". "off" - data integrity on app failure, "normal" - data integrity on app and OS failures, "full" - full data integrity on app or OS failures, slower
const DEFAULT_CACHE_SIZE = -1_048_576; // integer, 0+ - pages, -kilobytes, default 1G
const DEFAULT_BUSY_TIMEOUT = 30000; // 30 sec.

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

export default class DbhPoolSqlite extends Migration( Transactions() ) {
    #url;
    #database;
    #isRelative;

    #sqlite;
    #prepared = {};

    #types = { ...DEFAULT_TYPES_SQLITE.types };
    #encode = { ...DEFAULT_TYPES_SQLITE.encode };
    #decode = { ...DEFAULT_TYPES_SQLITE.decode };

    constructor ( url, options = {} ) {
        super();

        [this.#url, options] = this.#parseFileUrl( url );

        this.#sqlite = new Sqlite( this.#url, {
            "timeout": options.busyTimeout,
        } );

        this.#sqlite.defaultSafeIntegers( true );

        this.pragma( `encoding = "UTF-8"` );
        this.pragma( `temp_store = ${options.tempStore}` );
        this.pragma( `journal_mode = ${options.journalMode}` );
        this.pragma( `synchronous = ${options.synchronous}` );
        this.pragma( `cache_size = ${options.cacheSize}` );

        // create custom functions
        this.function( "sqlite_notify", ( name, data ) => {

            // reserved event
            if ( sqlConst.reservedEvents.has( name ) ) {
                if ( this.hasSchema ) throw Error( `SQLite event name "${name}" is reserved` );
                else return;
            }

            // unknown event
            if ( this.hasSchema && !this.emits.has( name ) ) throw Error( `SQLite event name "${name}" is unknown` );

            process.nextTick( () => this.emit( name, data ) );
        } );

        this.function( "uuid_generate_v4", () => {
            return uuid.v4();
        } );

        this.function( "gen_random_uuid", () => {
            return uuid.v4();
        } );

        this.function( "md5", str => {
            if ( str == null ) return null;

            return crypto.createHash( "MD5" ).update( str ).digest( "hex" );
        } );

        this.function( "time_hires", () => {
            return new Date().getTime() / 1000;
        } );

        // watch for notifications subscribe
        this.on( "newListener", this.#subscribe.bind( this ) );
    }

    // properties
    get isSqlite () {
        return true;
    }

    get url () {
        return this.#url;
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

    attach ( name, url, options = {} ) {
        [url, options] = this.#parseFileUrl( url );

        this.do( `ATTACH DATABASE '${url}' AS "${name}"` );

        this.pragma( `${name}.encoding = "UTF-8"` );
        this.pragma( `${name}.temp_store = ${options.tempStore}` );
        this.pragma( `${name}.journal_mode = ${options.journalMode}` );
        this.pragma( `${name}.synchronous = ${options.synchronous}` );
        this.pragma( `${name}.cache_size = ${options.cacheSize}` );
    }

    pragma ( pragma, options = {} ) {
        return this.#sqlite.pragma( pragma, options );
    }

    function ( name, options, callback ) {
        return this.#sqlite.function( name, options, callback );
    }

    aggregate ( name, options ) {
        return this.#sqlite.aggregate( name, options );
    }

    close () {
        return this.#sqlite.close();
    }

    // query
    exec ( query, params ) {
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

    do ( query, params ) {
        const res = this.#do( query, params, false, true );

        return res;
    }

    select ( query, params ) {
        const res = this.#do( query, params );

        return res;
    }

    selectRow ( query, params ) {
        const res = this.#do( query, params, true );

        return res;
    }

    // private
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

                res.meta.rows = data.changes;
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

                    res.meta.rows = data.length;

                    if ( firstRow ) data = data[0];

                    res.data = data;
                }
                else {
                    res.meta.rows = 0;
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
        if ( query instanceof Sql ) {
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
    #subscribe ( name ) {

        // reserved event
        if ( sqlConst.reservedEvents.has( name ) ) return;

        // already subscribed
        if ( this.listenerCount( name ) ) return;

        if ( this.hasSchema && !this.emits.has( name ) ) throw `Event name "${name}" is not emitted by the database`;
    }

    get isConnected () {
        return true;
    }

    waitConnect () {
        return;
    }

    #parseFileUrl ( url, options = {} ) {
        options = { ...options };

        url = new URL( url, "file:/a:/" );

        var pathname = _url.fileURLToPath( url ),
            relative = false;

        if ( pathname.startsWith( "a:\\" ) ) {
            relative = true;
            pathname = pathname.substring( 3 );
        }
        else if ( pathname.startsWith( "/a:/" ) ) {
            relative = true;
            pathname = pathname.substring( 4 );
        }

        // cache
        options.cache ||= url.searchParams.get( "cache" ) || DEFAULT_CACHE;

        // mode
        options.mode ||= url.searchParams.get( "mode" ) || DEFAULT_MODE;

        // tempStore
        options.tempStore ??= url.searchParams.get( "tempStore" ) || DEFAULT_TEMP_STORE;

        // journalMode
        options.journalMode ??= url.searchParams.get( "journalMode" ) || DEFAULT_JOURNAL_MODE;

        // synchronous
        options.synchronous ??= url.searchParams.get( "synchronous" ) || DEFAULT_SYNCHRONOUS;

        // cacheSize
        options.cacheSize ??= url.searchParams.get( "cacheSize" ) || DEFAULT_CACHE_SIZE;
        options.cacheSize = +options.cacheSize;
        if ( isNaN( options.cacheSize ) ) options.cacheSize = DEFAULT_CACHE_SIZE;

        // busyTimeout
        options.busyTimeout ??= url.searchParams.get( "busyTimeout" ) || DEFAULT_BUSY_TIMEOUT;
        options.busyTimeout = +options.busyTimeout;
        if ( isNaN( options.busyTimeout ) ) options.busyTimeout = DEFAULT_BUSY_TIMEOUT;

        const tmpl = new URL( "file:" );

        if ( options.cache !== DEFAULT_CACHE ) tmpl.searchParams.set( "cache", options.cache );
        if ( options.mode !== DEFAULT_MODE ) tmpl.searchParams.set( "mode", options.mode );
        if ( options.tempStore !== DEFAULT_TEMP_STORE ) tmpl.searchParams.set( "tempStore", options.tempStore );
        if ( options.journalMode !== DEFAULT_JOURNAL_MODE ) tmpl.searchParams.set( "journalMode", options.journalMode );
        if ( options.synchronous !== DEFAULT_SYNCHRONOUS ) tmpl.searchParams.set( "synchronous", options.synchronous );
        if ( options.cacheSize !== DEFAULT_CACHE_SIZE ) tmpl.searchParams.set( "cacheSize", options.cacheSize );
        if ( options.busyTimeout !== DEFAULT_BUSY_TIMEOUT ) tmpl.searchParams.set( "busyTimeout", options.busyTimeout );

        tmpl.searchParams.sort();

        if ( pathname === "" ) {
            url = "file:" + tmpl.search;
        }
        else if ( pathname === ":memory:" ) {
            url = "file::memory:" + tmpl.search;
        }
        else if ( relative ) {
            url = "file:" + encodeURI( pathname ) + tmpl.search;
        }
        else {
            url = _url.pathToFileURL( pathname ) + tmpl.search;
        }

        return [url, options];
    }
}
