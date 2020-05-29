const { IS_SQL_QUERY } = require( "../const" );
const { "v1": uuidv1 } = require( "uuid" );
const placeHolder = "?";
const ORDER_BY_DIRECTION = {
    "asc": "ASC",
    "desc": "DESC",
};
const CONDITION_OPERATORS = {
    "<": "<",
    "<=": "<=",
    "=": "=",
    ">=": ">=",
    ">": ">",
    "!=": "!=",
    "like": "LIKE",
    "in": "IN",
    "not in": "NOT IN",
    "is null": "IS NULL",
    "is not null": "IS NOT NULL",
};

class QueryBase {
    static [IS_SQL_QUERY] = true;

    isQuery ( object ) {
        return object != null && object.constructor[IS_SQL_QUERY];
    }

    // # https://www.postgresql.org/docs/current/static/sql-syntax-lexical.html
    quoteId ( id ) {
        return id
            .replace( /"/g, "" )
            .split( "." )
            .map( ( item ) => `"${item}"` )
            .join( "." );
    }

    _parseConditions ( args ) {
        const buf = [],
            params = [];

        // called as sql`...`
        if ( Array.isArray( args[0] ) ) {
            args = [sql( args.shift(), ...args )];
        }

        for ( const arg of args ) {

            // query
            if ( this.isQuery( arg ) ) {
                const subQuery = arg.getQuery();

                if ( subQuery ) {
                    buf.push( subQuery[0] );

                    params.push( ...subQuery[1] );
                }
            }

            // conditions obect
            else if ( typeof arg === "object" ) {
                const conds = [];

                for ( const field in arg ) {
                    let cond = this.quoteId( field ) + " ",
                        op,
                        val;

                    if ( Array.isArray( arg[field] ) ) {
                        [op, val] = [...arg[field]];

                        // validate operator
                        op = CONDITION_OPERATORS[op.toLowerCase()];

                        // operator is invalid
                        if ( !op ) throw Error( `SQL condition operator "${arg[field][0]}" is invalid` );
                    }
                    else {
                        if ( arg[field] == null ) {
                            op = "IS NULL";

                            val = [null];
                        }
                        else {
                            op = "=";

                            if ( Array.isArray( arg[field] ) ) {
                                val = arg[field];
                            }
                            else {
                                val = [arg[field]];
                            }
                        }
                    }

                    cond += op + " ";

                    if ( op !== "IS NULL" && op !== "IS NOT NULL" ) {
                        if ( op === "IN" || op === "NOT IN" ) cond += "(";

                        // process value
                        const valBuf = [];

                        for ( const v of val ) {
                            if ( this.isQuery( v ) ) {
                                const query = v.getQuery();

                                if ( v ) {
                                    valBuf.push( "(" + query[0] + ")" );

                                    params.push( ...query[1] );
                                }
                            }
                            else {
                                valBuf.push( placeHolder );

                                params.push( v );
                            }
                        }

                        cond += valBuf.join( ", " );

                        if ( op === "IN" || op === "NOT IN" ) cond += ")";
                    }

                    conds.push( cond );
                }

                if ( conds.length ) {
                    buf.push( conds.join( " AND " ) );
                }
            }
            else {
                throw Error( `SQL "${arg}" is invalid` );
            }
        }

        if ( buf.length ) {
            return [buf.join( " AND " ), params];
        }
    }
}

class Where extends QueryBase {
    #query = "";
    #params = [];

    constructor ( conditions ) {
        super();

        const query = this._parseConditions( conditions );

        if ( query ) [this.#query, this.#params] = query;
    }

    getQuery () {
        if ( this.#query ) {
            return [this.#query, this.#params];
        }
        else {
            return;
        }
    }

    and ( ...args ) {
        const query = new Where( args ).getQuery();

        if ( query ) {
            if ( this.#query ) {
                this.#query = "(" + this.#query + ") AND (" + query[0] + ")";
            }
            else {
                this.#query = query[0];
            }

            this.#params.push( ...query[1] );
        }

        return this;
    }

    or ( ...args ) {
        const query = new Where( args ).getQuery();

        if ( query ) {
            if ( this.#query ) {
                this.#query = "(" + this.#query + ") OR (" + query[0] + ")";
            }
            else {
                this.#query = query[0];
            }

            this.#params.push( ...query[1] );
        }

        return this;
    }
}

class Query extends QueryBase {
    #id = "";
    #query = "";
    #params = [];
    #postgresQuery;

    prepare () {
        if ( !this.#id ) this.#id = uuidv1();

        return this;
    }

    getQuery ( forPostgres ) {
        if ( forPostgres ) {
            if ( !this.#postgresQuery ) {
                let idx = 0;

                this.#postgresQuery = this.#query.replace( /\?/g, () => {
                    return "$" + ++idx;
                } );
            }

            return [this.#postgresQuery, this.#params, this.#id];
        }
        else {
            return [this.#query, this.#params, this.#id];
        }
    }

    // HELPERS
    _ ( query, ...params ) {
        var buf = [];

        // called as sql`...`
        if ( Array.isArray( query ) ) {
            if ( !query.raw ) throw Error( `SQL "${query}" is invalid` );

            for ( let idx = 0; idx < query.length; idx++ ) {
                const sql = query[idx].trim();

                if ( sql !== "" ) buf.push( sql );

                if ( idx < params.length ) {

                    // parameter is sub-query
                    if ( this.isQuery( params[idx] ) ) {
                        const subQuery = params[idx].getQuery();

                        if ( subQuery ) {
                            buf.push( subQuery[0] );

                            this.#params.push( ...subQuery[1] );
                        }
                    }

                    // parameter is not sub-query
                    else {
                        buf.push( placeHolder );

                        this.#params.push( params[idx] );
                    }
                }
            }
        }

        // called as sql(sql`...`)
        else if ( this.isQuery( query ) ) {
            const subQuery = query.getQuery();

            if ( subQuery ) {
                buf.push( subQuery[0] );

                this.#params.push( ...subQuery[1] );
            }
        }

        // called as sql("...")
        else if ( typeof query === "string" ) {

            // trim
            const sql = query.trim();

            if ( sql !== "" ) buf.push( sql );
        }
        else {
            throw Error( `SQL "${query}" is invalid` );
        }

        if ( buf.length ) {
            if ( this.#query ) this.#query += " ";

            this.#query += buf.join( " " );
        }

        return this;
    }

    SET ( values, ...fields ) {
        var buf = [],
            filter = !!fields.length;

        fields = Object.fromEntries( fields.map( ( field ) => [field, 1] ) );

        if ( typeof values === "object" ) {
            for ( const field in values ) {
                if ( filter && !fields[field] ) continue;

                // value is subquery
                if ( this.isQuery( values[field] ) ) {
                    const query = values[field].getQuery();

                    if ( query ) {
                        buf.push( this.quoteId( field ) + " = (" + query[0] + ")" );

                        this.#params.push( ...query[1] );
                    }
                }

                // valie is parameter
                else {
                    buf.push( this.quoteId( field ) + " = " + placeHolder );

                    this.#params.push( values[field] );
                }
            }
        }
        else {
            throw Error( `SQL set value "${values}" is invalid` );
        }

        this.#query += " SET " + buf.join( ", " );

        return this;
    }

    SET1 ( ...values ) {
        var buf = [];

        for ( const val of values ) {
            if ( !val ) continue;

            // subquery
            if ( this.isQuery( val ) ) {
                const subQuery = val.getQuery();

                if ( subQuery ) {
                    buf.push( subQuery[0] );

                    this.#params.push( ...subQuery[1] );
                }
            }

            // object
            else if ( typeof val === "object" ) {
                for ( const field in val ) {

                    // value is subquery
                    if ( this.isQuery( val[field] ) ) {
                        const subQuery = val[field].getQuery();

                        if ( subQuery ) {
                            buf.push( this.quoteId( field ) + " = " + subQuery[0] );

                            this.#params.push( ...subQuery[1] );
                        }
                    }

                    // valie is parameter
                    else {
                        buf.push( this.quoteId( field ) + " = " + placeHolder );

                        this.#params.push( val[field] );
                    }
                }
            }
            else {
                throw Error( `SQL set value "${val}" is invalid` );
            }
        }

        this.#query += " SET " + buf.join( ", " );

        return this;
    }

    VALUES ( values, ...fields ) {
        if ( !Array.isArray( values ) ) throw Error( `SQL value is invalid` );

        // create fields index
        if ( !fields.length ) {
            const idx = {};

            for ( const row of values ) {
                for ( const field in row ) {
                    if ( !idx[field] ) {
                        idx[field] = 1;

                        fields.push( field );
                    }
                }
            }
        }

        const rows = [];

        // create fields index
        for ( const row of values ) {
            const params = [];

            for ( const field of fields ) {
                const param = row[field];

                if ( this.isQuery( param ) ) {
                    const query = param.getQuery();

                    if ( query ) {
                        params.push( "(" + query[0] + ")" );

                        this.#params.push( ...query[1] );
                    }
                }
                else {
                    params.push( placeHolder );

                    this.#params.push( param );
                }
            }

            rows.push( "(" + params.join( ", " ) + ")" );
        }

        this.#query +=
            " (" +
            fields
                .map( ( field ) => {
                    return this.quoteId( field );
                } )
                .join( ", " ) +
            ") VALUES " +
            rows.join( ", " );

        return this;
    }

    WHERE ( ...args ) {
        const query = this._parseConditions( args );

        if ( query ) {
            this.#query += " WHERE " + query[0];

            this.#params.push( ...query[1] );
        }

        return this;
    }

    ON ( ...args ) {
        const query = this._parseConditions( args );

        if ( query ) {
            this.#query += " WHERE " + query[0];

            this.#params.push( ...query[1] );
        }

        return this;
    }

    HAVING ( ...args ) {
        const query = this._parseConditions( args );

        if ( query ) {
            this.#query += " WHERE " + query[0];

            this.#params.push( ...query[1] );
        }

        return this;
    }

    IN ( ...values ) {
        var buf = [];

        for ( const val1 of values ) {

            // skip undefined values
            if ( typeof val1 === "undefined" ) {
                continue;
            }
            else if ( Array.isArray( val1 ) ) {
                for ( const val2 of val1 ) {

                    // skip undefined value
                    if ( typeof val2 === "undefined" ) {
                        continue;
                    }
                    else {
                        buf.push( placeHolder );

                        this.#params.push( val2 );
                    }
                }
            }
            else {
                buf.push( placeHolder );

                this.#params.push( val1 );
            }
        }

        this.#query += " IN (" + buf.join( ", " ) + ")";

        return this;
    }

    GROUP_BY ( ...fields ) {
        var buf = [];

        for ( const field1 of fields ) {
            if ( Array.isArray( field1 ) ) {
                for ( const field2 of field1 ) {
                    if ( field2 ) buf.push( this.quoteId( field2 ) );
                }
            }
            else if ( field1 ) {
                buf.push( this.quoteId( field1 ) );
            }
        }

        if ( buf.length ) this.#query += " GROUP BY " + buf.join( ", " );

        return this;
    }

    ORDER_BY ( ...values ) {
        var buf = [];

        if ( values.length === 1 && Array.isArray( values[0] ) ) values = values[0];

        for ( const val of values ) {
            if ( !val ) continue;

            if ( Array.isArray( val ) ) {
                if ( val[0] ) {
                    if ( val[1] ) {
                        const direction = ORDER_BY_DIRECTION[val[1].toLowerCase()];

                        if ( direction ) {
                            buf.push( this.quoteId( val[0] ) + " " + direction );
                        }
                        else {
                            throw Error( `SQL order by direction "${val[1]}" is invalid` );
                        }
                    }
                    else {
                        buf.push( this.quoteId( val[0] ) );
                    }
                }
            }
            else {
                buf.push( this.quoteId( val ) );
            }
        }

        if ( buf.length ) this.#query += " ORDER BY " + buf.join( ", " );

        return this;
    }

    LIMIT ( value, options ) {
        if ( !options ) options = {};

        if ( !value ) {
            value = options.default || options.max;
        }
        else if ( typeof value !== "number" ) {
            throw Error( `SQL limit value "${value}" is invalid` );
        }
        else if ( options.max && value > options.max ) {
            value = options.max;
        }

        if ( value ) {
            this.#query += " LIMIT " + placeHolder;

            this.#params.push( value );
        }

        return this;
    }

    OFFSET ( value ) {
        if ( value != null ) {
            if ( typeof value === "number" ) {
                this.#query += " OFFSET " + placeHolder;

                this.#params.push( value );
            }
            else {
                throw Error( `SQL offset value "${value}" is invalid` );
            }
        }

        return this;
    }
}

function sql () {
    return new Query()._( ...arguments );
}

module.exports.sql = sql;

module.exports.WHERE = function ( ...args ) {
    return new Where( args );
};
