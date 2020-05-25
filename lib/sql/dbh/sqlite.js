const { Dbh } = require( "../dbh" );
const Database = require( "better-sqlite3" );
const { "v1": uuidv1, "v4": uuidv4 } = require( "uuid" );
const crypto = require( "crypto" );
const { res, parseRes, parseError } = require( "../../result" );
const { IS_SQL } = require( "../../const" );

// https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md

module.exports = class extends Dbh {
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
    #maxParams = 999;
    lastInsertRowid;

    constructor ( url, options ) {
        super( url );

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

        this.#dbh = new Database( this.url.pathname || ":memory:", {
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

    attach ( name, path ) {
        this.do( `ATTACH DATABASE '${path || ":memory:"}' AS "${name}"` );

        this.#dbh.pragma( `${name}.encoding = "UTF-8"` );
        this.#dbh.pragma( `${name}.temp_store = ${this.tempStore}` );
        this.#dbh.pragma( `${name}.journal_mode = ${this.journalMode}` );
        this.#dbh.pragma( `${name}.synchronous = ${this.synchronous}` );
        this.#dbh.pragma( `${name}.cache_size = ${this.cacheSize}` );
        this.#dbh.pragma( `${name}.foreign_keys = ${this.foreignKeys}` );
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
                return `'${value.replace( /'/, "'" )}'`;
            }
        }
        else if ( Buffer.isBuffer( value ) ) {
            return `x'${value.toString( "hex" )}'`;
        }
        else {
            throw Error( `SQLite type is not supported` );
        }
    }

    getMaxParams () {
        return this.#maxParams;
    }

    inTransaction () {
        return this.#dbh.inTransaction;
    }

    async do ( query, params ) {
        let id;

        if ( query.constructor[IS_SQL] ) {
            id = query.getId();

            [query, params] = query.getQuery( params, this );
        }

        // use "run" method
        if ( id || params ) {
            let stmt;

            // try to get cached stmt
            if ( id ) stmt = this.#prepared[id];

            // stmt is not cached
            if ( !stmt ) {
                // prepare stmt
                try {
                    stmt = this.#dbh.prepare( query );
                }
                catch ( e ) {
                    return this._onError( e, query );
                }
            }

            // cache stmt
            if ( id ) this.#prepared[id] = stmt;

            try {
                let result;

                if ( params ) {
                    result = stmt.run( params );
                }
                else {
                    result = stmt.run();
                }

                this.lastInsertRowid = result.lastInsertRowid;

                return res( 200, result );
            }
            catch ( e ) {
                return this._onError( e, query );
            }
        }

        // use "exec" method
        else {
            try {
                this.#dbh.exec( query );

                return res( 200 );
            }
            catch ( e ) {
                return this._onError( e, query );
            }
        }
    }

    async selectAll ( query, params ) {
        return this._select( "all", query, params );
    }

    async selectRow ( query, params ) {
        return this._select( "get", query, params );
    }

    async begin ( mode, func ) {
        // transaction is already dtarted
        if ( this.inTransaction() ) {
            return this._onError( Error( "Already in transaction. Use savepoints." ), "BEGIN" );
        }

        if ( typeof mode === "function" ) {
            func = mode;
            mode = "BEGIN";
        }
        else {
            mode = "BEGIN " + mode;
        }

        let result,
            tres = await this.do( mode );

        // unable to start stransaction
        if ( !tres.isOk() ) return tres;

        try {
            result = parseRes( await func( this ) );

            tres = await this.do( "COMMIT" );

            if ( !tres.isOk() ) result = tres;
        }
        catch ( e ) {
            tres = await this.do( "ROLLBACK" );

            if ( !tres.isOk() ) {
                result = tres;
            }
            else {
                result = parseError( e );
            }
        }

        return result;
    }

    async _select ( method, query, params ) {
        let id, stmt;

        if ( query.constructor[IS_SQL] ) {
            id = query.getId();

            [query, params] = query.getQuery( params, this );
        }

        // try to get cached stmt
        if ( id ) stmt = this.#prepared[id];

        // stmt is not cached
        if ( !stmt ) {
            // prepare stmt
            try {
                stmt = this.#dbh.prepare( query );
            }
            catch ( e ) {
                return this._onError( e, query );
            }
        }

        // cache stmt
        if ( id ) this.#prepared[id] = stmt;

        try {
            let result;

            if ( params ) {
                result = stmt[method]( params );
            }
            else {
                result = stmt[method]();
            }

            return res( 200, result );
        }
        catch ( e ) {
            return this._onError( e, query );
        }
    }
};
