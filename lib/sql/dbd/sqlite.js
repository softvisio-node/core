const { DbhPool } = require( "../dbd" );
const { res } = require( "../../result" );
const { SQL_TYPE, SQL_MAX_PARAMS_SQLITE } = require( "../../const" );
const TYPES = require( "../dbi" ).TYPES.sqlite;
const Sqlite = require( "better-sqlite3" );
const { "v1": uuidv1, "v4": uuidv4 } = require( "uuid" );
const crypto = require( "crypto" );
const util = require( "util" );

// https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md

module.exports = class DbhPoolSqlite extends DbhPool {
    isSqlite = true;
    lastInsertRowid;

    #options = {
        "readOnly": false,
        "create": true,
        "busyTimeout": 3000,
        "tempStore": "MEMORY", // [FILE, MEMORY]
        "journalMode": "WAL", // [DELETE, TRUNCATE, PERSIST, MEMORY, WAL, OFF], WAL is the best
        "synchronous": "OFF", // [FULL, NORMAL, OFF], OFF - data integrity on app failure, NORMAL - data integrity on app and OS failures, FULL - full data integrity on app or OS failures, slower
        "cacheSize": -1_048_576, // Int, 0+ - pages,  -kilobytes, default 1G
        "foreignKeys": 1,
    };

    #dbh;
    #prepared = {};

    constructor ( url, options ) {
        super( url, options );

        if ( !options ) options = {};

        for ( const option in this.#options ) {
            const urlOption = url[option];

            const val = options[option] || url.searchParams.get( option ) || urlOption;

            if ( val != null ) this.#options[option] = val;
        }

        this.#dbh = new Sqlite( url.pathname || ":memory:", {
            "readonly": this.#options.readOnly,
            "fileMustExist": !this.#options.create,
            "timeout": this.#options.busyTimeout,
        } );

        this.#dbh.pragma( `encoding = "UTF-8"` );
        this.#dbh.pragma( `temp_store = ${this.#options.tempStore}` );
        this.#dbh.pragma( `journal_mode = ${this.#options.journalMode}` );
        this.#dbh.pragma( `synchronous = ${this.#options.synchronous}` );
        this.#dbh.pragma( `cache_size = ${this.#options.cacheSize}` );
        this.#dbh.pragma( `foreign_keys = ${this.#options.foreignKeys}` );

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

    quote ( param ) {

        // null
        if ( param == null ) {
            return "NULL";
        }
        else {

            // param is tagged with the type
            if ( param[SQL_TYPE] ) param = TYPES.to[param[SQL_TYPE]]( param );

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

            // buffer
            else if ( Buffer.isBuffer( param ) ) {
                return "x'" + param.toString( "hex" ) + "'";
            }

            // date
            else if ( util.types.isDate( param ) ) {
                return "'" + param.toISOString() + "'";
            }
            else {
                throw Error( `Unsupported SQL parameter type "${param}"` );
            }
        }
    }

    attach ( name, path ) {
        this.do( `ATTACH DATABASE '${path || ":memory:"}' AS "${name}"` );

        this.#dbh.pragma( `${name}.encoding = "UTF-8"` );
        this.#dbh.pragma( `${name}.temp_store = ${this.#options.tempStore}` );
        this.#dbh.pragma( `${name}.journal_mode = ${this.#options.journalMode}` );
        this.#dbh.pragma( `${name}.synchronous = ${this.#options.synchronous}` );
        this.#dbh.pragma( `${name}.cache_size = ${this.#options.cacheSize}` );
        this.#dbh.pragma( `${name}.foreign_keys = ${this.#options.foreignKeys}` );
    }

    // POOL
    async _getDbh () {
        return res( 200, this );
    }

    _onDbhReady ( dbh ) {}

    // QUERY
    async do ( query, params ) {
        query = this._prepareQuery( query, params );

        // use "run" method if query is prepared or has params
        if ( query[1] || query[2] ) {
            let sth;

            // try to get cached sth
            if ( query[2] ) sth = this.#prepared[query[2]];

            // sth is not cached
            if ( !sth ) {

                // prepare sth
                try {
                    sth = this.#dbh.prepare( query[0] );
                }
                catch ( e ) {
                    return this._onQueryError( e, query[0] );
                }
            }

            // cache sth
            if ( query[2] ) this.#prepared[query[2]] = sth;

            try {
                let result;

                // run with params
                if ( query[1] ) {
                    result = sth.run( this._prepareParams( query[1] ) );
                }

                // run wuthout params
                else {
                    result = sth.run();
                }

                this.lastInsertRowid = result.lastInsertRowid;

                return res( 200, null, { "rows": result.changes } );
            }
            catch ( e ) {
                return this._onQueryError( e, query[0] );
            }
        }

        // use "exec" method
        else {
            try {
                this.#dbh.exec( query[0] );

                return res( 200 );
            }
            catch ( e ) {
                return this._onQueryError( e, query[0] );
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

        // transaction is already started
        if ( this.inTransaction() ) return this._onQueryError( Error( "Already in transaction. Use savepoints." ), "BEGIN" );

        return super.begin( mode, func );
    }

    async _select ( method, query, params ) {
        query = this._prepareQuery( query, params );

        var sth;

        // try to get cached sth
        if ( query[2] ) sth = this.#prepared[query[2]];

        // sth is not cached
        if ( !sth ) {

            // prepare sth
            try {
                sth = this.#dbh.prepare( query[0] );
            }
            catch ( e ) {
                return this._onQueryError( e, query[0] );
            }
        }

        // cache sth
        if ( query[2] ) this.#prepared[query[2]] = sth;

        try {
            let result;

            if ( query[1] ) {
                result = sth[method]( this._prepareParams( query[1] ) );
            }
            else {
                result = sth[method]();
            }

            if ( result ) {
                const columns = sth.columns(),
                    decodeColumns = {};

                let decode;

                for ( const column of columns ) {
                    let type = column.type;

                    if ( type ) {
                        type = type.toLowerCase();

                        if ( TYPES.from[type] ) {
                            decode = true;

                            decodeColumns[column.name] = TYPES.from[type];
                        }
                    }
                }

                if ( decode ) {
                    let isObject;

                    if ( !Array.isArray( result ) ) {
                        isObject = true;

                        result = [result];
                    }

                    for ( const row of result ) {
                        for ( const name in decodeColumns ) {
                            if ( row[name] != null ) row[name] = decodeColumns[name]( row[name] );
                        }
                    }

                    if ( isObject ) result = result[0];
                }
            }

            return res( 200, result );
        }
        catch ( e ) {
            return this._onQueryError( e, query[0] );
        }
    }

    _prepareQuery ( query, params ) {

        // query object
        if ( this.isQuery( query ) ) {
            query = query.getQuery( false );

            // override params
            if ( params ) query[1] = params;

            if ( !query[1].length ) query[1] = null;
        }

        // query is string
        else {
            query = [query, params, null];
        }

        // serialize query if number of params exceeded
        if ( query[1] && query[1].length > SQL_MAX_PARAMS_SQLITE ) {
            return [this.queryToString( query[0], query[1] ), null, null];
        }
        else {
            return query;
        }
    }

    _prepareParams ( params ) {
        return params.map( ( param ) => {

            // null
            if ( param == null ) {
                return null;
            }
            else {

                // param is tagged with the type
                if ( param[SQL_TYPE] ) param = TYPES.to[param[SQL_TYPE]]( param );

                if ( typeof param === "boolean" ) {
                    return param === true ? 1 : 0;
                }

                // date
                else if ( util.types.isDate( param ) ) {
                    return param.toISOString();
                }

                // return as is
                else {
                    return param;
                }
            }
        } );
    }
};
