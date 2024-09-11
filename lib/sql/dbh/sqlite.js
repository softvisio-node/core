import "#lib/result";
import mixins from "#lib/mixins";
import Dbh from "#lib/sql/dbh";
import Sqlite from "@softvisio/sqlite";
import uuid from "#lib/uuid";
import crypto from "node:crypto";
import { encodeDate, sqliteDecoders } from "#lib/sql/types";
import Transactions from "./sqlite/transactions.js";
import Schema from "./sqlite/schema.js";
import constants from "#lib/sql/constants";
import { sql } from "#lib/sql/query";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MAX_PARAMS = 999;
const MIN_BIGINT = -9_223_372_036_854_775_808n;
const MAX_BIGINT = 9_223_372_036_854_775_807n;
const MIN_BIGINT_NUMBER = BigInt( Number.MIN_SAFE_INTEGER );
const MAX_BIGINT_NUMBER = BigInt( Number.MAX_SAFE_INTEGER );

const DEFAULT_CACHE = "private"; // "shared", "private"
const DEFAULT_MODE = "rwc"; // "ro", "rw", "rwc", "memory"
const DEFAULT_TEMP_STORE = "memory"; // "file", "memory"
const DEFAULT_JOURNAL_MODE = "wal"; // "delete", "truncate", "persist", "memory", "wal", "off". "wal" is the best.
const DEFAULT_SYNCHRONOUS = "off"; // "full", "normal", "off". "off" - data integrity on app failure, "normal" - data integrity on app and OS failures, "full" - full data integrity on app or OS failures, slower
const DEFAULT_CACHE_SIZE = -1_048_576; // integer, 0+ - pages, -kilobytes, default 1G
const DEFAULT_BUSY_TIMEOUT = 30_000; // 30 sec.

// NOTE https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md

const SQL = {
    "publishQuery": sql`SELECT sqlite_notify( ?, ? )`.prepare(),
};

export default class DbhPoolSqlite extends mixins( Transactions, Dbh ) {
    #url;
    #sqlite;
    #prepared = {};

    #schema = new Schema( this );
    #destroyed = false;

    #decode = { ...sqliteDecoders };

    constructor ( url, options = {} ) {
        super();

        [ this.#url, options ] = this.#parseFileUrl( url, options );

        this.#sqlite = new Sqlite( this.#url, {
            "timeout": options.busyTimeout,
        } );

        this.#sqlite.defaultSafeIntegers( true );

        this.pragma( `encoding = "UTF-8"` );
        this.pragma( `temp_store = ${ options.tempStore }` );
        this.pragma( `journal_mode = ${ options.journalMode }` );
        this.pragma( `synchronous = ${ options.synchronous }` );
        this.pragma( `cache_size = ${ options.cacheSize }` );

        // create custom functions
        this.function( "sqlite_notify", ( name, data ) => {

            // reserved event
            if ( constants.reservedEvents.has( name ) ) {
                if ( this.schema.isLoaded ) throw Error( `SQLite event name "${ name }" is reserved` );
                else return;
            }

            // unknown event
            if ( this.schema.isLoaded && !this.schema.isEventValid( name ) ) throw Error( `SQLite event name "${ name }" is unknown` );

            process.nextTick( () => this.emit( name, data ) );
        } );

        this.function( "gen_random_uuid", () => {
            return uuid();
        } );

        this.function( "gen_random_uuid", () => {
            return uuid();
        } );

        this.function( "md5", str => {
            if ( str == null ) return null;

            return crypto.createHash( "MD5" ).update( str ).digest( "hex" );
        } );

        this.function( "time_hires", () => {
            return Date.now() / 1000;
        } );

        // watch for notifications subscribe
        this.watch( this.#watcher.bind( this ) );
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

    get schema () {
        return this.#schema;
    }

    get isDestroyed () {
        return this.#destroyed;
    }

    // public
    async start () {
        return this.schema.cron.start();
    }

    async stop () {
        return this.schema.cron.stop();
    }

    async shutDown () {
        return this.schema.cron.shutDown();
    }

    toString () {
        return this.url;
    }

    toJSON () {
        return this.url;
    }

    quote ( value ) {

        // null
        if ( value == null ) {
            return "NULL";
        }
        else {

            // string
            if ( typeof value === "string" ) {

                // if value contains ZERO character
                // ignore, to make it comatible with postgres, where 0x00 in strings is disabled
                // if ( param.indexOf( "\0" ) > -1 ) {
                //     return "CAST(x'" + Buffer.from( param ).toString( "hex" ) + "' AS TEXT)";
                // }
                // else {
                return "'" + value.replaceAll( "'", "''" ) + "'";

                // }
            }

            // number
            else if ( typeof value === "number" ) {
                return value;
            }

            // boolean
            else if ( typeof value === "boolean" ) {
                return value === true ? "TRUE" : "FALSE";
            }

            // bigint
            else if ( typeof value === "bigint" ) {
                if ( value < MIN_BIGINT || value > MAX_BIGINT ) throw RangeError( `BigInt number must be between ${ MIN_BIGINT } and ${ MAX_BIGINT }` );

                return value.toString();
            }

            // object
            else if ( typeof value === "object" ) {

                // buffer
                if ( Buffer.isBuffer( value ) ) {
                    return "x'" + value.toString( "hex" ) + "'";
                }

                // date
                else if ( value instanceof Date ) {
                    return "'" + encodeDate( value ) + "'";
                }

                // object
                else {
                    return "'" + JSON.stringify( value ).replace( /'/g, "''" ) + "'";
                }
            }

            // invalid type
            else {
                throw TypeError( `Unsupported SQL parameter type "${ value }"` );
            }
        }
    }

    attach ( name, url, options = {} ) {
        [ url, options ] = this.#parseFileUrl( url, options );

        this.do( `ATTACH DATABASE '${ url }' AS "${ name }"` );

        this.pragma( `${ name }.encoding = "UTF-8"` );
        this.pragma( `${ name }.temp_store = ${ options.tempStore }` );
        this.pragma( `${ name }.journal_mode = ${ options.journalMode }` );
        this.pragma( `${ name }.synchronous = ${ options.synchronous }` );
        this.pragma( `${ name }.cache_size = ${ options.cacheSize }` );
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

    destroy () {
        if ( this.destroyed ) return;

        this.#destroyed = true;

        this.#sqlite.close();
    }

    // query
    exec ( query, params ) {
        if ( params && !Array.isArray( params ) ) params = params.params;

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
        const res = this.#do( query, params, { "ignoreData": true } );

        return res;
    }

    select ( query, params ) {
        const res = this.#do( query, params );

        return res;
    }

    selectRow ( query, params ) {
        const res = this.#do( query, params, { "firstRow": true } );

        return res;
    }

    // private
    #do ( query, params, options = {} ) {
        if ( params && !Array.isArray( params ) ) {
            options = { ...params, ...options };

            params = options.params;
        }

        query = this.#prepareQuery( query, params );

        var sth, decode;

        // query is prepared
        if ( query.id && this.#prepared[ query.id ] ) {
            sth = this.#prepared[ query.id ].sth;
            decode = this.#prepared[ query.id ].decode;
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

                    // get type from query.decode by column name
                    if ( query.types?.[ column.name ] ) {
                        type = query.types[ column.name ];

                        // invalid column decode type
                        if ( typeof type === "string" && !this.#decode[ type ] ) return this._onQueryError( Error( `Invalid decode type for column "${ column.name }"` ), query.query );
                    }

                    // get type by column type
                    else {
                        type = column.type;
                    }

                    if ( typeof type === "string" ) {
                        type = this.#decode[ type ];
                    }

                    if ( type ) {
                        _decode ||= {};

                        _decode[ column.name ] = type;
                    }
                }

                if ( _decode ) decode = _decode;
            }

            // cache sth
            if ( query.id ) {
                this.#prepared[ query.id ] = {
                    sth,
                    decode,
                };
            }
        }

        // check correct dbh method usage
        if ( options.ignoreData ) {
            if ( sth.reader ) throw `Invalid usage, you need to execute query, that returns data, using "select" method, ` + query.query;
        }
        else if ( !sth.reader ) throw `Invalid usage, you need to execute query, that returns no data, using "do" method, ` + query.query;

        const ignoreData = options.ignoreData || !sth.reader;

        try {
            let data, res;

            const method = ignoreData ? "run" : options.firstRow ? "get" : "all";

            if ( query.params ) {
                data = sth[ method ]( this.#prepareParams( query.params ) );
            }
            else {
                data = sth[ method ]();
            }

            // "do" request
            if ( ignoreData ) {
                res = result( 200, null );

                res.meta.rows = data.changes;
            }

            // "select" request
            else {
                res = result( 200 );

                if ( !options.firstRow && !data.length ) data = null;

                if ( data ) {
                    if ( options.firstRow ) data = [ data ];

                    // decode columns
                    for ( const row of data ) {
                        for ( const name in row ) {
                            if ( row[ name ] == null ) continue;

                            // decode with column decoder
                            if ( decode?.[ name ] ) {
                                row[ name ] = decode[ name ]( row[ name ] );
                            }

                            // decode bigint
                            else if ( typeof row[ name ] === "bigint" ) {

                                // bigint is too big for number
                                if ( row[ name ] < MIN_BIGINT_NUMBER || row[ name ] > MAX_BIGINT_NUMBER ) {
                                    throw RangeError( `BigInt in column "${ name }" is too big for Number` );
                                }

                                // safe to decode bigint to number
                                row[ name ] = Number( row[ name ] );
                            }
                        }
                    }

                    res.meta.rows = data.length;

                    if ( options.firstRow ) data = data[ 0 ];

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

        if ( typeof query === "string" ) {
            query = sql( query );
        }
        else {
            params ||= query.params;
        }

        if ( !params?.length ) params = null;

        if ( params && ( toString || params.length > MAX_PARAMS ) ) {
            sth = {
                "query": this.queryToString( query, params ),
                "types": query.types,
            };
        }
        else {
            sth = {
                "id": query.id,
                "query": query.sqliteQuery,
                params,
                "types": query.types,
            };
        }

        return sth;
    }

    #prepareParams ( params ) {
        const _params = [];

        for ( const param of params ) {

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

                    // buffer
                    if ( param instanceof Buffer ) {
                        _params.push( param );
                    }

                    // date
                    else if ( param instanceof Date ) {
                        _params.push( encodeDate( param ) );
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

    // notifications
    #watcher ( name, subscribe ) {
        if ( !subscribe ) return;

        // reserved event
        if ( constants.reservedEvents.has( name ) ) return;

        if ( this.schema.isLoaded && !this.schema.isEventValid( name ) ) throw `Event name "${ name }" is not emitted by the database`;
    }

    get isConnected () {
        return true;
    }

    waitConnect () {
        return;
    }

    publish ( name, data ) {
        this.select( SQL.publishQuery, [ name, data ] );
    }

    #parseFileUrl ( url, options = {} ) {
        options = { ...options };

        var relative;

        if ( url instanceof URL ) {
            url = new URL( url );
        }
        else {

            // url string
            if ( url.startsWith( "file:" ) ) {

                // relative
                if ( !url.startsWith( "file:/" ) ) {
                    url = new URL( url );

                    if ( url.pathname !== "/" && url.pathname !== "/:memory:" ) {
                        relative = true;

                        url.pathname = path.join( process.cwd(), url.pathname );
                    }
                }

                // absolute
                else {
                    url = new URL( url );
                }
            }

            // path
            else {
                if ( !path.isAbsolute( url ) && url !== ":memory:" ) {
                    relative = true;

                    url = path.join( process.cwd(), url );
                }

                url = new URL( "/" + url, "file:" );
            }
        }

        // not a file url
        if ( url.protocol !== "file:" ) {
            throw Error( `Invalid SQL protocol` );
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
        options.cacheSize ||= +( url.searchParams.get( "cacheSize" ) || DEFAULT_CACHE_SIZE );
        if ( !Number.isInteger( options.cacheSize ) ) throw TypeError( `SQLite cacheSize is invalid` );

        // busyTimeout
        options.busyTimeout ||= +( url.searchParams.get( "busyTimeout" ) || DEFAULT_BUSY_TIMEOUT );
        if ( !Number.isInteger( options.busyTimeout ) || options.busyTimeout <= 0 ) throw TypeError( `SQLite busyTimeout is invalid` );

        const urlSearchParams = new URLSearchParams();

        if ( options.cache !== DEFAULT_CACHE ) urlSearchParams.set( "cache", options.cache );
        if ( options.tempStore !== DEFAULT_TEMP_STORE ) urlSearchParams.set( "tempStore", options.tempStore );
        if ( options.journalMode !== DEFAULT_JOURNAL_MODE ) urlSearchParams.set( "journalMode", options.journalMode );
        if ( options.synchronous !== DEFAULT_SYNCHRONOUS ) urlSearchParams.set( "synchronous", options.synchronous );
        if ( options.cacheSize !== DEFAULT_CACHE_SIZE ) urlSearchParams.set( "cacheSize", options.cacheSize );
        if ( options.busyTimeout !== DEFAULT_BUSY_TIMEOUT ) urlSearchParams.set( "busyTimeout", options.busyTimeout );
        if ( options.mode !== DEFAULT_MODE && options.mode !== "memory" ) urlSearchParams.set( "mode", options.mode );

        urlSearchParams.sort();

        // temp
        if ( url.pathname === "/" ) {
            url = "file:";
        }

        // memory
        else if ( url.pathname === "/:memory:" || options.mode === "memory" ) {
            url = "file::memory:";
        }
        else if ( relative ) {
            url = "file:" + path.relative( process.cwd(), fileURLToPath( url ) ).replaceAll( "\\", "/" );
        }
        else {
            url = "file:" + url.pathname;
        }

        if ( urlSearchParams.size ) url += "?" + urlSearchParams.toString();

        return [ url, options ];
    }
}
