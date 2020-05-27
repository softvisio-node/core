const { DbhPool } = require( "../dbd" );
const { res } = require( "../../result" );
const { SQL_MAX_PARAMS_SQLITE } = require( "../../const" );
const Sqlite = require( "better-sqlite3" );
const { "v1": uuidv1, "v4": uuidv4 } = require( "uuid" );
const crypto = require( "crypto" );

// https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md

module.exports = class DbhPoolSqlite extends DbhPool {
    isSqlite = true;

    readOnly = false;
    create = true;
    busyTimeout = 3000;
    tempStore = "MEMORY"; // [FILE, MEMORY]
    journalMode = "WAL"; // [DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF], WAL is the best
    synchronous = "OFF"; // [FULL, NORMAL, OFF], OFF - data integrity on app failure, NORMAL - data integrity on app and OS failures, FULL - full data integrity on app or OS failures, slower
    cacheSize = -1_048_576; // Int, 0+ - pages,  -kilobytes, default 1G
    foreignKeys = 1;

    #dbh;
    #prepared = {};
    #maxParams = SQL_MAX_PARAMS_SQLITE;
    lastInsertRowid;

    // TODO
    constructor ( url, options ) {
        super( url, options );

        if ( options ) {
            if ( options.readOnly != null ) this.readOnly = options.readOnly;
            if ( options.create != null ) this.create = options.create;
            if ( options.busyTimeout != null ) this.busyTimeout = options.busyTimeout;
            if ( options.tempStore != null ) this.tempStore = options.tempStore;
            if ( options.journalMode != null ) this.journalMode = options.journalMode;
            if ( options.synchronous != null ) this.synchronous = options.synchronous;
            if ( options.cacheSize != null ) this.cacheSize = options.cacheSize;
            if ( options.foreignKeys != null ) this.foreignKeys = options.foreignKeys;
        }

        this.#dbh = new Sqlite( this.url.pathname || ":memory:", {
            "readonly": this.readOnly,
            "fileMustExist": !this.create,
            "timeout": this.busyTimeout,
        } );

        this.#dbh.pragma( `encoding = "UTF-8"` );
        this.#dbh.pragma( `temp_store = ${this.tempStore}` );
        this.#dbh.pragma( `journal_mode = ${this.journalMode}` );
        this.#dbh.pragma( `synchronous = ${this.synchronous}` );
        this.#dbh.pragma( `cache_size = ${this.cacheSize}` );
        this.#dbh.pragma( `foreign_keys = ${this.foreignKeys}` );

        // create custom functions
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

        this.#dbh.function( "md5", ( str ) => {
            return crypto.createHash( "MD5" ).update( str ).digest( "hex" );
        } );

        this.#dbh.function( "time_hires", () => {
            return new Date().getTime() / 1000;
        } );
    }

    inTransaction () {
        return this.#dbh.inTransaction;
    }

    quote ( value ) {
        if ( value == null ) {
            return "NULL";
        }
        else if ( typeof value === "boolean" ) {
            return value ? "TRUE" : "FALSE";
        }
        else if ( typeof value === "number" ) {
            return value;
        }
        else if ( typeof value === "string" ) {

            // if value contains NUL charavter
            if ( value.indexOf( "\0" ) > -1 ) {
                return `CAST(x'${Buffer.from( value ).toString( "hex" )}' AS TEXT)`;
            }
            else {
                return `'${value.replace( /'/, "''" )}'`;
            }
        }
        else if ( Buffer.isBuffer( value ) ) {
            return `x'${value.toString( "hex" )}'`;
        }
        else {
            throw Error( `SQLite type is not supported` );
        }
    }

    attach ( name, path ) {
        this.do( `ATTACH DATABASE '${path || ":memory:"}' AS "${name}"` );

        this.#dbh.pragma( `${name}.encoding = "UTF-8"` );
        this.#dbh.pragma( `${name}.temp_store = ${this.tempStore}` );
        this.#dbh.pragma( `${name}.journal_mode = ${this.journalMode}` );
        this.#dbh.pragma( `${name}.synchronous = ${this.synchronous}` );
        this.#dbh.pragma( `${name}.cache_size = ${this.cacheSize}` );
        this.#dbh.pragma( `${name}.foreign_keys = ${this.foreignKeys}` );
    }

    // POOL
    async _getDbh () {
        return res( 200, this );
    }

    // QUERY
    async do ( query, params ) {
        query = this._prepareQuery( query, params );

        // use "run" method if query is prepared or has params
        if ( query[1] || query[2] ) {
            let stmt;

            // try to get cached stmt
            if ( query[2] ) stmt = this.#prepared[query[2]];

            // stmt is not cached
            if ( !stmt ) {

                // prepare stmt
                try {
                    stmt = this.#dbh.prepare( query[0] );
                }
                catch ( e ) {
                    return this._onError( e, query[0] );
                }
            }

            // cache stmt
            if ( query[2] ) this.#prepared[query[2]] = stmt;

            try {
                let result;

                if ( query[1] ) {
                    result = stmt.run( this._prepareParams( query[1] ) );
                }
                else {
                    result = stmt.run();
                }

                this.lastInsertRowid = result.lastInsertRowid;

                return res( 200, result );
            }
            catch ( e ) {
                return this._onError( e, query[0] );
            }
        }

        // use "exec" method
        else {
            try {
                this.#dbh.exec( query[0] );

                return res( 200 );
            }
            catch ( e ) {
                return this._onError( e, query[0] );
            }
        }
    }

    async selectAll ( query, params ) {
        return this._select( "all", query, params );
    }

    async selectRow ( query, params ) {
        return this._select( "get", query, params );
    }

    async _select ( method, query, params ) {
        query = this._prepareQuery( query, params );

        var stmt;

        // try to get cached stmt
        if ( query[2] ) stmt = this.#prepared[query[2]];

        // stmt is not cached
        if ( !stmt ) {

            // prepare stmt
            try {
                stmt = this.#dbh.prepare( query[0] );
            }
            catch ( e ) {
                return this._onError( e, query[0] );
            }
        }

        // cache stmt
        if ( query[2] ) this.#prepared[query[2]] = stmt;

        try {
            let result;

            if ( query[1] ) {
                result = stmt[method]( this._prepareParams( query[1] ) );
            }
            else {
                result = stmt[method]();
            }

            return res( 200, result );
        }
        catch ( e ) {
            return this._onError( e, query[0] );
        }
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

    _prepareParams ( params ) {
        return params.map( ( param ) => {
            if ( typeof param === "boolean" ) {
                return param ? 1 : 0;
            }
            else {
                return param;
            }
        } );
    }
};
