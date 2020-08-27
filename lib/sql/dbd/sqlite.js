const { DbhPool } = require( "../dbd" );
const result = require( "../../result" );
const { SQL_TYPE } = require( "../../const" );
const TYPES = require( "../dbi" ).TYPES.sqlite;
const Sqlite = require( "better-sqlite3" );
const { "v1": uuidv1, "v4": uuidv4 } = require( "uuid" );
const crypto = require( "crypto" );
const util = require( "util" );
const MAX_PARAMS = 999;
const { Where, Query } = require( "../dbi" );

// NOTE https://github.com/JoshuaWise/better-sqlite3/blob/master/docs/api.md

class DbdWhere extends Where {

    // in sqlite LIKE operator is case-insensitive by default (PRAGMA case_sensitive_like = true)
    _getLikeOperator () {
        return "LIKE";
    }
}

class DbdQuery extends Query {

    // in sqlite LIKE operator is case-insensitive by default (PRAGMA case_sensitive_like = true)
    _getLikeOperator () {
        return "LIKE";
    }
}

module.exports = class DbhPoolSqlite extends DbhPool {
    isSqlite = true;
    lastInsertRowId;

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

        this.#dbh.function( "md5", str => {
            if ( str == null ) return null;

            return crypto.createHash( "MD5" ).update( str ).digest( "hex" );
        } );

        this.#dbh.function( "time_hires", () => {
            return new Date().getTime() / 1000;
        } );
    }

    WHERE ( ...args ) {
        return new DbdWhere( args );
    }

    sql () {
        return new DbdQuery().sql( ...arguments );
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
    _getDbh ( forTransaction ) {
        return this;
    }

    _pushDbh ( dbh ) {}

    // QUERY
    async exec ( query, params ) {
        query = this._prepareQuery( query, params, true );

        try {
            this.#dbh.exec( query[0] );

            return result( 200 );
        }
        catch ( e ) {
            return this._onQueryError( e, query[0] );
        }
    }

    async do ( query, params ) {
        return this._do( query, params, false, true );
    }

    async selectAll ( query, params ) {
        return this._do( query, params );
    }

    async selectRow ( query, params ) {
        return this._do( query, params, true );
    }

    async begin ( mode, func ) {

        // transaction is already started
        if ( this.inTransaction() ) return this._onQueryError( Error( "Already in transaction. Use savepoints." ), "BEGIN" );

        return super.begin( mode, func );
    }

    async _do ( query, params, firstRow, ignoreData ) {
        query = this._prepareQuery( query, params );

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
                        type = type.toUpperCase();

                        if ( TYPES.from[type] ) {
                            _decode = true;

                            columns[column.name] = TYPES.from[type];
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

        try {
            let res;

            const method = !sth.reader ? "run" : firstRow ? "get" : "all";

            if ( query[1] ) {
                res = sth[method]( this._prepareParams( query[1] ) );
            }
            else {
                res = sth[method]();
            }

            if ( !sth.reader ) {
                this.lastInsertRowId = res.lastInsertRowid;

                return result( 200, null, { "rows": res.changes } );
            }

            // .do("SELECT ..."), has no sense, just for compatibility with postgres
            else if ( ignoreData ) {
                return result( 200 );
            }
            else {
                if ( !firstRow && !res.length ) res = null;

                if ( res && decode ) {
                    if ( firstRow ) res = [res];

                    for ( const row of res ) {
                        for ( const name in decode ) {
                            if ( row[name] != null ) row[name] = decode[name]( row[name] );
                        }
                    }

                    if ( firstRow ) res = res[0];
                }

                return result( 200, res );
            }
        }
        catch ( e ) {
            return this._onQueryError( e, query[0] );
        }
    }

    _prepareQuery ( query, params, toString ) {

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

    _prepareParams ( params ) {
        return params.map( param => {

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
