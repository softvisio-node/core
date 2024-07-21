import { objectIsPlain, objectPick } from "#lib/utils";
import uuid from "#lib/uuid";
import GlobPatterns from "#lib/glob/patterns";
import path from "node:path";

const PLACEHOLDER = "?";

const ORDER_BY_DIRECTION = {
    "asc": "ASC",
    "desc": "DESC",
};

const CONDITION_OPERATORS = {
    "<": {
        "sql": "<",
    },
    "<=": {
        "sql": "<=",
    },
    "=": {
        "sql": "=",
    },
    ">=": {
        "sql": ">=",
    },
    ">": {
        "sql": ">",
    },
    "!=": {
        "sql": "!=",
    },

    // like
    "like": {
        "sql": "LIKE",
        "isLike": true,
    },
    "not like": {
        "sql": "NOT LIKE",
        "isLike": true,
    },
    "ilike": {
        "sql": "ILIKE",
        "isLike": true,
    },
    "not ilike": {
        "sql": "NOT ILIKE",
        "isLike": true,
    },

    // includes
    "includes": {
        "sql": "LIKE",
        "isIncludes": true,
    },
    "not includes": {
        "sql": "NOT LIKE",
        "isIncludes": true,
    },
    "includes case insensitive": {
        "sql": "ILIKE",
        "isIncludes": true,
    },
    "not includes case insensitive": {
        "sql": "NOT ILIKE",
        "isIncludes": true,
    },

    // starts with
    "starts with": {
        "sql": "LIKE",
        "isStartsWith": true,
    },
    "not starts with": {
        "sql": "NOT LIKE",
        "isStartsWith": true,
    },
    "starts with case insensitive": {
        "sql": "ILIKE",
        "isStartsWith": true,
    },
    "not starts with case insensitive": {
        "sql": "NOT ILIKE",
        "isStartsWith": true,
    },

    // ends with
    "ends with": {
        "sql": "LIKE",
        "isEndsWith": true,
    },
    "not ends with": {
        "sql": "NOT LIKE",
        "isEndsWith": true,
    },
    "ends with case insensitive": {
        "sql": "ILIKE",
        "isEndsWith": true,
    },
    "not ends with case insensitive": {
        "sql": "NOT ILIKE",
        "isEndsWith": true,
    },

    // glob
    "glob": {
        "isGlob": true,
        "isCaseSensitive": true,
        "allowed": "~",
        "ignored": "!~",
    },
    "glob case insensitive": {
        "isGlob": true,
        "isCaseSensitive": false,
        "allowed": "~*",
        "ignored": "!~*",
    },

    // in
    "in": {
        "sql": "IN",
        "isIn": true,
    },
    "not in": {
        "sql": "NOT IN",
        "isIn": true,
    },

    // regular expressions
    "~": {
        "sql": "~",
    },
    "~*": {
        "sql": "~*",
    },
    "!~": {
        "sql": "!~",
    },
    "!~*": {
        "sql": "!~*",
    },
};

export function calcOffsetLimit ( offset, limit, { maxResults, defaultLimit, maxLimit } = {} ) {
    if ( offset ) {
        if ( typeof offset !== "number" || offset < 0 ) throw Error( `SQL offset value "${ offset }" is invalid` );
    }
    else {
        offset ||= 0;
    }

    if ( limit == null ) {
        limit = defaultLimit || maxLimit || null;
    }
    else if ( typeof limit !== "number" || limit < 0 ) {
        throw Error( `SQL limit value "${ limit }" is invalid` );
    }
    else if ( maxLimit && limit > maxLimit ) {
        limit = maxLimit;
    }

    var maxResultsLimit;

    // apply max results
    if ( maxResults && limit !== 0 ) {

        // offset is too large
        if ( offset && offset >= maxResults ) {
            limit = 0;
            maxResultsLimit = true;
        }

        // all rows requested
        else if ( limit == null ) {
            limit = maxResults - offset;
            maxResultsLimit = true;
        }
        else {
            const requestedResults = offset + limit;

            if ( requestedResults > maxResults ) {
                limit = limit - ( requestedResults - maxResults );
            }

            maxResultsLimit = requestedResults >= maxResults;
        }
    }

    return { offset, limit, maxResultsLimit };
}

export function quoteLikePattern ( pattern ) {
    return pattern.replaceAll( "\\", "\\\\" ).replaceAll( "_", "\\_" ).replaceAll( "%", "\\%" );
}

const queryAccessor = Symbol();

export class Sql {
    #query = "";
    #postgresqlQuery;
    #sqliteQuery;

    // properties
    get query () {
        return this.#query;
    }

    get postgresqlQuery () {
        if ( !this.#postgresqlQuery ) {
            let n = 0;

            this.#postgresqlQuery = this.#query.replaceAll( "?", () => "$" + ++n );
        }

        return this.#postgresqlQuery;
    }

    get sqliteQuery () {

        // in sqlite LIKE operator is case-insensitive by default (PRAGMA case_sensitive_like = true)
        this.#sqliteQuery ??= this.#query.replaceAll( " ILIKE ", " LIKE " );

        return this.#sqliteQuery;
    }

    // public
    toString () {
        return this.#query;
    }

    // https://www.postgresql.org/docs/current/static/sql-syntax-lexical.html
    quoteId ( id ) {
        return id
            .replace( /"/g, "" )
            .split( "." )
            .map( item => `"${ item }"` )
            .join( "." );
    }

    // protected
    _parseConditions ( args ) {
        const buf = [],
            params = [];

        // called as sql`...`
        if ( Array.isArray( args[ 0 ] ) ) {
            args = [ sql( args.shift(), ...args ) ];
        }

        for ( const arg of args ) {

            // skip null
            if ( arg == null ) {
                continue;
            }

            // query
            if ( arg instanceof Sql ) {
                if ( arg.query ) {
                    buf.push( arg.query );

                    params.push( ...arg.params );
                }
            }

            // string
            else if ( typeof arg === "string" ) {

                // trim
                const sql = arg.trim();

                if ( sql !== "" ) buf.push( sql );
            }

            // conditions obect
            else if ( typeof arg === "object" ) {
                const conditions = [];

                for ( const field in arg ) {
                    let condition = this.quoteId( field ) + " ",
                        operator,
                        value;

                    if ( Array.isArray( arg[ field ] ) ) {
                        [ operator, value ] = arg[ field ];
                    }
                    else {
                        operator = "=";
                        value = arg[ field ];
                    }

                    // validate operator
                    operator = CONDITION_OPERATORS[ ( operator + "" ).toLowerCase() ];

                    if ( !operator ) throw Error( `SQL condition operator is invalid` );

                    // value is array
                    if ( Array.isArray( value ) ) {
                        if ( operator.sql === "=" ) {
                            operator = CONDITION_OPERATORS[ "in" ];
                        }
                        else if ( operator.sql === "!=" ) {
                            operator = CONDITION_OPERATORS[ "not in" ];
                        }
                        else if ( !operator.isIn && !operator.isGlob ) {
                            throw Error( `SQL condition operator is invalid` );
                        }
                    }

                    // value is null
                    if ( value == null ) {
                        if ( operator.sql === "=" ) {
                            condition += "IS NULL";
                        }
                        else if ( operator.sql === "!=" ) {
                            condition += "IS NOT NULL";
                        }
                        else {
                            throw Error( `SQL condition operator is invalid` );
                        }
                    }

                    // value is query
                    else if ( value instanceof Sql ) {
                        if ( value.query ) {
                            condition += operator.sql + " ( " + value.query + " )";
                            params.push( ...value.params );
                        }
                    }

                    // like
                    else if ( operator.isLike ) {
                        condition += operator.sql + " " + PLACEHOLDER + " ESCAPE '\\'";
                        params.push( value );
                    }

                    // includes
                    else if ( operator.isIncludes ) {
                        condition += operator.sql + " " + PLACEHOLDER + " ESCAPE '\\'";
                        params.push( "%" + quoteLikePattern( value ) + "%" );
                    }

                    // starts with
                    else if ( operator.isStartsWith ) {
                        condition += operator.sql + " " + PLACEHOLDER + " ESCAPE '\\'";
                        params.push( quoteLikePattern( value ) + "%" );
                    }

                    // ends with
                    else if ( operator.isEndsWith ) {
                        condition += operator.sql + " " + PLACEHOLDER + " ESCAPE '\\'";
                        params.push( "%" + quoteLikePattern( value ) );
                    }

                    // glob
                    else if ( operator.isGlob ) {
                        let patterns, cwd;

                        if ( Array.isArray( value ) ) {
                            [ patterns, { cwd } = {} ] = value;

                            if ( !Array.isArray( patterns ) ) {
                                patterns = [ patterns ];
                            }
                        }
                        else {
                            patterns = [ value ];
                        }

                        // path
                        if ( patterns.length === 1 && !GlobPatterns.isGlobPattern( patterns[ 0 ] ) ) {
                            const filePath = path.posix.join( "/", cwd || "", patterns[ 0 ] );

                            if ( operator.isCaseSensitive ) {
                                condition += "= " + PLACEHOLDER;
                                params.push( filePath );
                            }
                            else {
                                condition += "ILIKE " + PLACEHOLDER + " ESCAPE '\\'";
                                params.push( quoteLikePattern( filePath ) );
                            }
                        }

                        // patterns
                        else {
                            patterns = new GlobPatterns( { "caseSensitive": operator.isCaseSensitive } ).add( patterns, { "prefix": cwd } );

                            // allwed list has no patterns
                            if ( !patterns.allowedList.hasPatterns ) {
                                condition = "FALSE";
                            }

                            // ignore all
                            else if ( patterns.ignoredList.has( "!**", { "prefix": cwd } ) ) {
                                condition = "FALSE";
                            }

                            // allwed list has patterns
                            else {
                                const id = this.quoteId( field );

                                condition = "( ";

                                // add prefix
                                if ( cwd ) {
                                    if ( operator.isCaseSensitive ) {
                                        condition += id + " LIKE " + PLACEHOLDER + " ESCAPE '\\'";
                                    }
                                    else {
                                        condition += id + " ILIKE " + PLACEHOLDER + " ESCAPE '\\'";
                                    }

                                    cwd = path.posix.join( "/", cwd );

                                    if ( !cwd.endsWith( "/" ) ) cwd += "/";

                                    params.push( quoteLikePattern( cwd ) + "%" );
                                }

                                // allw all
                                if ( patterns.allowedList.has( "**", { "prefix": cwd } ) ) {
                                    if ( !cwd ) {
                                        condition += `${ id } IS NOT NULL`;
                                    }
                                }

                                // allwed list match patterns
                                else {
                                    if ( cwd ) condition += " AMD ";

                                    condition += `${ id } ${ operator.allowed } ${ PLACEHOLDER }`;

                                    params.push( patterns.allowedList.pattern );
                                }

                                // ignore patterns
                                if ( patterns.ignoredList.hasPatterns ) {
                                    condition += ` AND ${ id } ${ operator.ignored } ${ PLACEHOLDER }`;

                                    params.push( patterns.ignoredList.pattern );
                                }

                                condition += " )";
                            }
                        }
                    }

                    // in
                    else if ( operator.isIn ) {
                        const values = value,
                            sql = [];

                        if ( !Array.isArray( values ) ) throw Error( `SQL condition operator is invalid` );

                        for ( const value of values ) {
                            if ( value instanceof Sql ) {
                                if ( value.query ) {
                                    sql.push( "( " + value.query + " )" );
                                    params.push( ...value.params );
                                }
                            }
                            else {
                                sql.push( PLACEHOLDER );
                                params.push( value );
                            }
                        }

                        condition += operator.sql + " ( " + sql.join( ", " ) + " )";
                    }
                    else {
                        condition += operator.sql + " " + PLACEHOLDER;
                        params.push( value );
                    }

                    conditions.push( condition );
                }

                if ( conditions.length ) {
                    buf.push( conditions.join( " AND " ) );
                }
            }
            else {
                throw Error( `SQL "${ arg }" is invalid` );
            }
        }

        if ( buf.length ) {
            return [ buf.join( " " ), params ];
        }
    }

    // private
    get [ queryAccessor ] () {
        return this.#query;
    }

    set [ queryAccessor ] ( value ) {
        if ( this.id ) throw Error( `Prepared query can't be modified` );

        this.#query = value;

        this.#postgresqlQuery = null;
        this.#sqliteQuery = null;
    }
}

class Where extends Sql {
    #params = [];

    constructor ( conditions ) {
        super();

        const query = this._parseConditions( conditions );

        if ( query ) [ this[ queryAccessor ], this.#params ] = query;
    }

    // properties
    get params () {
        return this.#params;
    }

    // public
    and ( ...args ) {
        const query = new this.constructor( args );

        if ( query.query ) {
            if ( this[ queryAccessor ] ) {
                this[ queryAccessor ] = "(" + this[ queryAccessor ] + ") AND (" + query.query + ")";
            }
            else {
                this[ queryAccessor ] = query.query;
            }

            this.#params.push( ...query.params );
        }

        return this;
    }

    or ( ...args ) {
        const query = new this.constructor( args );

        if ( query.query ) {
            if ( this[ queryAccessor ] ) {
                this[ queryAccessor ] = "(" + this[ queryAccessor ] + ") OR (" + query.query + ")";
            }
            else {
                this[ queryAccessor ] = query.query;
            }

            this.#params.push( ...query.params );
        }

        return this;
    }
}

class Query extends Sql {
    #id;
    #readOnly;
    #dynamic;
    #params = [];
    #decode;

    // properties
    get id () {
        if ( this.#dynamic ) return null;

        return this.#id;
    }

    get isReadOnly () {
        return this.#readOnly;
    }

    get IsDynamic () {
        return this.#dynamic;
    }

    get params () {
        return this.#params;
    }

    get types () {
        return this.#decode;
    }

    // public
    sql ( query, ...params ) {
        var buf = [];

        // called as sql`...`
        if ( Array.isArray( query ) ) {
            if ( !query.raw ) throw Error( `SQL "${ query }" is invalid` );

            for ( let idx = 0; idx < query.length; idx++ ) {
                const sql = query[ idx ].trim();

                if ( sql !== "" ) buf.push( sql );

                if ( idx < params.length ) {

                    // parameter is sub-query
                    if ( params[ idx ] instanceof Sql ) {
                        if ( params[ idx ].query ) {
                            buf.push( params[ idx ].query );

                            this.#params.push( ...params[ idx ].params );
                        }
                    }

                    // parameter is not sub-query
                    else {
                        buf.push( PLACEHOLDER );

                        this.#params.push( params[ idx ] );
                    }
                }
            }
        }

        // called as sql(sql`...`)
        else if ( query instanceof Sql ) {
            if ( query.query ) {
                buf.push( query.query );

                this.#params.push( ...query.params );
            }
        }

        // called as sql("...")
        else if ( typeof query === "string" ) {

            // trim
            const sql = query.trim();

            if ( sql !== "" ) buf.push( sql );
        }
        else {
            throw Error( `SQL "${ query }" is invalid` );
        }

        if ( buf.length ) {
            if ( this[ queryAccessor ] ) this[ queryAccessor ] += " ";

            this[ queryAccessor ] += buf.join( " " );
        }

        return this;
    }

    // column_name: typ_name
    decode ( columns ) {
        this.#decode = columns;

        return this;
    }

    prepare () {
        if ( this.#dynamic ) throw Error( `Dynamic SQL query can not be prepared` );

        this.#id ??= uuid();

        return this;
    }

    readOnly ( value ) {
        this.#readOnly = value;

        return this;
    }

    // helpers
    ID ( value ) {
        this[ queryAccessor ] += " " + this.quoteId( value ) + " ";

        return this;
    }

    SET ( values, fields ) {
        this.#dynamic = true;

        var buf = [];

        if ( typeof values === "object" ) {
            if ( fields ) values = objectPick( values, fields );

            for ( const field in values ) {

                // value is subquery
                if ( values[ field ] instanceof Sql ) {
                    const query = values[ field ];

                    if ( query.query ) {
                        buf.push( this.quoteId( field ) + " = ( " + query.query + " )" );

                        this.#params.push( ...query.params );
                    }
                }

                // valie is parameter
                else {
                    buf.push( this.quoteId( field ) + " = " + PLACEHOLDER );

                    this.#params.push( values[ field ] );
                }
            }
        }
        else {
            throw Error( `SQL set value "${ values }" is invalid` );
        }

        this[ queryAccessor ] += " SET " + buf.join( ", " );

        return this;
    }

    // rows: {} || [{}]
    // index: [String], "firstRow", "fullScan". "fullScan" is default
    VALUES ( rows, { index = "fullScan" } = {} ) {
        this.#dynamic = true;

        const [ fields, _rows ] = this.#processValues( rows, index );

        if ( fields ) {
            this[ queryAccessor ] += " ( " + fields.map( field => this.quoteId( field ) ).join( ", " ) + " )";
        }

        this[ queryAccessor ] += " VALUES " + _rows.join( ", " );

        return this;
    }

    // rows: {} || [{}]
    // index: [String], "firstRow", "fullScan". "fullScan" is default
    VALUES_AS ( alias, rows, { index = "fullScan" } = {} ) {
        this.#dynamic = true;

        const [ fields, _rows ] = this.#processValues( rows, index );

        this[ queryAccessor ] += ` ( VALUES ` + _rows.join( ", " ) + ` ) AS ` + this.quoteId( alias ) + ` ( ` + fields.map( field => this.quoteId( field ) ).join( ", " ) + ` )`;

        return this;
    }

    FROM ( ...values ) {
        this.#dynamic = true;

        var from = [];

        for ( const value of values ) {

            // skip undefined values
            if ( value == null ) {
                continue;
            }
            else if ( Array.isArray( value ) ) {
                for ( const value1 of value ) {

                    // skip undefined value
                    if ( value1 == null ) {
                        continue;
                    }
                    else {
                        from.push( this.quoteId( value1 ) );
                    }
                }
            }
            else {
                from.push( this.quoteId( value ) );
            }
        }

        this[ queryAccessor ] += " FROM " + from.join( ", " );

        return this;
    }

    WHERE ( ...conditions ) {
        this.#dynamic = true;

        const query = this._parseConditions( conditions );

        if ( query ) {
            this[ queryAccessor ] += " WHERE " + query[ 0 ];

            this.#params.push( ...query[ 1 ] );
        }

        return this;
    }

    ON ( ...conditions ) {
        this.#dynamic = true;

        const query = this._parseConditions( conditions );

        if ( query ) {
            this[ queryAccessor ] += " WHERE " + query[ 0 ];

            this.#params.push( ...query[ 1 ] );
        }

        return this;
    }

    HAVING ( ...conditions ) {
        this.#dynamic = true;

        const query = this._parseConditions( conditions );

        if ( query ) {
            this[ queryAccessor ] += " WHERE " + query[ 0 ];

            this.#params.push( ...query[ 1 ] );
        }

        return this;
    }

    IN ( values ) {
        this.#dynamic = true;

        var buf = [];

        for ( const val1 of values ) {

            // skip undefined values
            if ( typeof val1 === "undefined" ) {
                continue;
            }
            else {
                buf.push( PLACEHOLDER );

                this.#params.push( val1 );
            }
        }

        this[ queryAccessor ] += " IN (" + buf.join( ", " ) + ")";

        return this;
    }

    GROUP_BY ( fields ) {
        this.#dynamic = true;

        var buf = [];

        for ( const field of fields ) {
            if ( field ) {
                buf.push( this.quoteId( field ) );
            }
        }

        if ( buf.length ) this[ queryAccessor ] += " GROUP BY " + buf.join( ", " );

        return this;
    }

    ORDER_BY ( values ) {
        this.#dynamic = true;

        if ( values ) {
            const buf = [];

            for ( const value of values ) {
                const direction = ORDER_BY_DIRECTION[ value[ 1 ] || "asc" ];

                if ( direction ) {
                    buf.push( this.quoteId( value[ 0 ] ) + " " + direction );
                }
                else {
                    throw Error( `SQL order by direction "${ value[ 1 ] }" is invalid` );
                }
            }

            if ( buf.length ) this[ queryAccessor ] += " ORDER BY " + buf.join( ", " );
        }

        return this;
    }

    OFFSET_LIMIT ( _offset, _limit, options ) {
        this.#dynamic = true;

        const { offset, limit } = calcOffsetLimit( _offset, _limit, options );

        if ( offset ) {
            this[ queryAccessor ] += " OFFSET " + PLACEHOLDER;

            this.#params.push( offset );
        }

        if ( limit != null ) {
            this[ queryAccessor ] += " LIMIT " + PLACEHOLDER;

            this.#params.push( limit === -1 ? 0 : limit );
        }

        return this;
    }

    LIMIT ( limit, { defaultLimit, maxLimit } = {} ) {
        this.#dynamic = true;

        if ( limit == null ) {
            limit = defaultLimit || maxLimit || null;
        }
        else if ( typeof limit !== "number" || limit < 0 ) {
            throw Error( `SQL limit value "${ limit }" is invalid` );
        }
        else if ( maxLimit && limit > maxLimit ) {
            limit = maxLimit;
        }

        if ( limit != null ) {
            this[ queryAccessor ] += " LIMIT " + PLACEHOLDER;

            this.#params.push( limit );
        }

        return this;
    }

    OFFSET ( offset ) {
        this.#dynamic = true;

        if ( offset ) {
            if ( typeof offset !== "number" || offset < 0 ) throw Error( `SQL offset value "${ offset }" is invalid` );

            this[ queryAccessor ] += " OFFSET " + PLACEHOLDER;

            this.#params.push( offset );
        }

        return this;
    }

    // private
    #processValues ( rows, index ) {
        if ( objectIsPlain( rows ) ) {
            rows = [ rows ];
        }
        else if ( !Array.isArray( rows ) ) {
            throw TypeError( `SQL rows value is not a array` );
        }

        var fields;

        const valueIsObject = objectIsPlain( rows[ 0 ] );

        // create fields index
        if ( Array.isArray( index ) ) {
            fields = index;
        }
        else if ( valueIsObject ) {
            fields = [];

            // build full fields index
            if ( index === "fullScan" ) {
                const idx = {};

                for ( const row of rows ) {
                    for ( const field in row ) {
                        idx[ field ] = true;
                    }
                }

                fields = Object.keys( idx );
            }

            // build fields index from the first row only
            else if ( index === "firstRow" ) {
                fields = Object.keys( rows[ 0 ] );
            }
            else {
                throw Error( `SQL fields value is invalid` );
            }
        }

        const _rows = [];

        // create rows
        for ( const row of rows ) {
            const params = [];

            // object
            if ( valueIsObject ) {
                for ( const field of fields ) {
                    const param = row[ field ];

                    if ( param instanceof Sql ) {
                        if ( param.query ) {
                            params.push( "( " + param.query + " )" );

                            this.#params.push( ...param.params );
                        }
                    }
                    else {
                        params.push( PLACEHOLDER );

                        this.#params.push( param );
                    }
                }
            }

            // array
            else {
                for ( const param of row ) {
                    if ( param instanceof Sql ) {
                        if ( param.query ) {
                            params.push( "( " + param.query + " )" );

                            this.#params.push( ...param.params );
                        }
                    }
                    else {
                        params.push( PLACEHOLDER );

                        this.#params.push( param );
                    }
                }
            }

            _rows.push( "( " + params.join( ", " ) + " )" );
        }

        return [ fields, _rows ];
    }
}

export function sql () {
    return new Query().sql( ...arguments );
}

Object.defineProperties( sql, {
    "where": {
        "value": function ( ...args ) {
            return new Where( args );
        },
    },
    "calcOffsetLimit": {
        "value": calcOffsetLimit,
    },
    "quoteLikePattern": {
        "value": quoteLikePattern,
    },
} );
