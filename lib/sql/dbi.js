const { IS_SQL } = require( "../const" );
const { "v1": uuidv1 } = require( "uuid" );
const placeHolder = "?";
const ORDER_BY_DIRECTION = {
    "asc": "ASC",
    "desc": "DESC",
};
const CONDITIONS = {
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
    "not is null": "NOT IS NULL",
};

class QueryBase {
    static [IS_SQL] = true;

    isQuery ( object ) {
        return object != null && object.constructor[IS_SQL];
    }

    quoteId ( id ) {
        return id
            .replace( /"/g, "" )
            .split( "." )
            .map( ( item ) => `"${item}"` )
            .join( "." );
    }
}

class Where extends QueryBase {
    #query = "";
    #params = [];

    // TODO support tagged tmpl, subQuery, object
    constructor () {
        super();
    }

    // TODO
    and () {
        return this;
    }

    // TODO
    or () {
        return this;
    }
}

class Query extends QueryBase {
    #id;
    #query = "";
    #params = [];
    #postgresQuery;

    prepare () {
        if ( !this.#id ) this.#id = uuidv1();

        return this;
    }

    // TODO return null qury
    getQuery ( forPostgres ) {
        if ( forPostgres === "$" ) {
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
        if ( this.#query ) this.#query += " ";

        // called as sql`...`
        if ( Array.isArray( query ) ) {
            if ( !query.raw ) throw Error( `SQL "${query}" is invalid` );

            for ( let idx = 0; idx < query.length; idx++ ) {
                const sql = query[idx].trim();

                if ( sql !== "" ) this.#query += sql;

                if ( idx < params.length ) {

                    // parameter is sub-query
                    if ( this.isQuery( params[idx] ) ) {
                        const subQuery = params[idx].getQuery();

                        if ( subQuery ) {
                            this.#query += subQuery[0];

                            this.#params.push( ...subQuery[1] );
                        }
                    }

                    // parameter is not sub-query
                    else {
                        this.#query += placeHolder;

                        this.#params.push( params[idx] );
                    }
                }
            }
        }

        // called as sql(sql`...`)
        else if ( this.isQuery( query ) ) {
            const subQuery = query.getQuery();

            if ( subQuery ) {
                this.#query += subQuery[0];

                this.#params.push( ...subQuery[1] );
            }
        }

        // called as sql("...")
        else if ( typeof query === "string" ) {

            // trim
            const sql = query.trim();

            if ( sql !== "" ) this.#query += sql;
        }
        else {
            throw Error( `SQL "${query}" is invalid` );
        }

        return this;
    }

    SET ( ...values ) {
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

    // TODO
    VALUES () {
        return this;
    }

    WHERE ( ...values ) {
        return this._addCondition( "WHERE", values );
    }

    ON ( ...values ) {
        return this._addCondition( "ON", values );
    }

    HAVING ( ...values ) {
        return this._addCondition( "HAVING", values );
    }

    IN ( ...values ) {
        var buf = [];

        for ( const val1 of values ) {

            // skip undefined values
            if ( val1 === undefined ) {
                continue;
            }
            else if ( Array.isArray( val1 ) ) {
                for ( const val2 of val1 ) {

                    // skip undefined value
                    if ( val2 === undefined ) {
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

        this.#query += " IN(" + buf.join( ", " ) + ")";

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

    // TODO
    _addCondition ( tag, values ) {
        var buf = [];

        for ( const val of values ) {
            if ( !val ) continue;

            // subquery
            if ( val.constructor[IS_SQL] ) {
                const query = val.getQuery();

                if ( query ) {
                    buf.push( query[0] );

                    this.#params.push( ...query[1] );
                }
            }

            // object
            else if ( typeof val === "object" ) {
                for ( const field in val ) {
                    let sql = this.quoteId( field ) + " ";

                    if ( val[field] == null ) {
                        sql += "IS NULL";
                    }
                    else if ( Array.isArray( val[field] ) ) {
                        const op = CONDITIONS[val[field][0]];

                        // validate operator
                        if ( !op ) throw Error( `Condition operator "${val[field][0]}" is invalid` );

                        if ( op === "IS NULL" ) {
                            sql += "IS NULL";
                        }
                        else if ( op === "NOT IS NULL" ) {
                            sql += "NOT IS NULL";
                        }
                        else {
                            let v;

                            // process value
                            if ( val[field][1].constructor[IS_SQL] ) {
                                const query = val[field][1].getQuery();

                                v = query[0];

                                this.#params.push( ...query[1] );
                            }
                            else {
                                v = val[field][1];
                            }

                            if ( op === "IN" || op === "NOT IN" ) {
                            }
                            else {
                                sql += op + " " + placeHolder;

                                this.#params.push( v );
                            }
                        }
                    }

                    // subquery
                    else if ( val[field].constructor[IS_SQL] ) {
                        const query = val[field].getQuery();

                        sql += "= ( " + query[0] + " )";

                        this.#params.push( ...query[1] );
                    }

                    // parameter
                    else {
                        sql += "= " + placeHolder;

                        this.#params.push( val[field] );
                    }

                    buf.push( sql );
                }
            }
            else {
                throw Error( `SQL condition value "${val}" is invalid` );
            }
        }

        if ( buf.length ) this.#query += " " + tag + " " + buf.join( " AND " );

        return this;
    }
}

module.exports.sql = function () {
    return new Query()._( ...arguments );
};

module.exports.WHERE = function () {
    return new Where( ...arguments );
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 397:67        | no-empty                     | Empty block statement.                                                         |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
