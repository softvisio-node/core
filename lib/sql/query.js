import { objectIsPlain, objectPick } from "#lib/utils";
import * as uuid from "#lib/uuid";

const PLACEHOLDER = "?";

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
};

export class SQL {
    get _likeOperator () {
        return "LIKE";
    }

    // https://www.postgresql.org/docs/current/static/sql-syntax-lexical.html
    quoteId ( id ) {
        return id
            .replace( /"/g, "" )
            .split( "." )
            .map( item => `"${item}"` )
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
            if ( arg instanceof SQL ) {
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
                const conds = [];

                for ( const field in arg ) {
                    let cond = this.quoteId( field ) + " ",
                        op,
                        isLike,
                        val;

                    // field value is [operator, value]
                    if ( Array.isArray( arg[field] ) ) {
                        [op, val] = arg[field];

                        // validate operator
                        op = CONDITION_OPERATORS[op.toLowerCase()];

                        // operator is invalid
                        if ( !op ) throw Error( `SQL condition operator "${arg[field][0]}" is invalid` );

                        if ( op === "!=" ) {
                            if ( val == null ) {
                                op = "IS NOT NULL";
                                val = [null];
                            }
                        }
                        else if ( op === "LIKE" ) {
                            isLike = true;

                            op = this._likeOperator;
                        }

                        if ( !Array.isArray( val ) ) val = [val];
                    }

                    // field value is value without operator
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

                    cond += op;

                    if ( op !== "IS NULL" && op !== "IS NOT NULL" ) {
                        cond += " ";

                        if ( op === "IN" || op === "NOT IN" ) cond += "(";

                        // process value
                        const valBuf = [];

                        for ( const v of val ) {
                            if ( v instanceof SQL ) {
                                if ( v.query ) {
                                    valBuf.push( "(" + v.query + ")" );

                                    params.push( ...v.params );
                                }
                            }
                            else {

                                // prepare LIKE values
                                if ( isLike && typeof v === "string" ) {
                                    valBuf.push( PLACEHOLDER + " ESCAPE '\\'" );

                                    params.push( "%" + v.replace( /([%_])/g, match => "\\" + match[0] ) + "%" );
                                }
                                else {
                                    valBuf.push( PLACEHOLDER );

                                    params.push( v );
                                }
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
            return [buf.join( " " ), params];
        }
    }
}

export class Where extends SQL {
    #query = "";
    #params = [];

    constructor ( conditions ) {
        super();

        const query = this._parseConditions( conditions );

        if ( query ) [this.#query, this.#params] = query;
    }

    // properties
    get query () {
        return this.#query;
    }

    get params () {
        return this.#params;
    }

    and ( ...args ) {
        const query = new this.constructor( args );

        if ( query.query ) {
            if ( this.#query ) {
                this.#query = "(" + this.#query + ") AND (" + query.query + ")";
            }
            else {
                this.#query = query.query;
            }

            this.#params.push( ...query.params );
        }

        return this;
    }

    or ( ...args ) {
        const query = new this.constructor( args );

        if ( query.query ) {
            if ( this.#query ) {
                this.#query = "(" + this.#query + ") OR (" + query.query + ")";
            }
            else {
                this.#query = query.query;
            }

            this.#params.push( ...query.params );
        }

        return this;
    }
}

export class Query extends SQL {
    #id = "";
    #query = "";
    #queryPgsql;
    #params = [];
    #decode;

    // properties
    get id () {
        return this.#id;
    }

    get query () {
        return this.#query;
    }

    get queryPgsql () {
        if ( !this.#queryPgsql ) {
            let n = 0;

            this.#queryPgsql = this.#query.replaceAll( "?", () => "$" + ++n );
        }

        return this.#queryPgsql;
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
            if ( !query.raw ) throw Error( `SQL "${query}" is invalid` );

            for ( let idx = 0; idx < query.length; idx++ ) {
                const sql = query[idx].trim();

                if ( sql !== "" ) buf.push( sql );

                if ( idx < params.length ) {

                    // parameter is sub-query
                    if ( params[idx] instanceof SQL ) {
                        if ( params[idx].query ) {
                            buf.push( params[idx].query );

                            this.#params.push( ...params[idx].params );
                        }
                    }

                    // parameter is not sub-query
                    else {
                        buf.push( PLACEHOLDER );

                        this.#params.push( params[idx] );
                    }
                }
            }
        }

        // called as sql(sql`...`)
        else if ( query instanceof SQL ) {
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
            throw Error( `SQL "${query}" is invalid` );
        }

        if ( buf.length ) {
            if ( this.#query ) this.#query += " ";

            this.#query += buf.join( " " );
        }

        return this;
    }

    // column_name: typ_name
    decode ( columns ) {
        this.#decode = columns;

        return this;
    }

    prepare () {
        if ( !this.#id ) this.#id = uuid.v4();

        return this;
    }

    // helpers
    SET ( values, fields ) {
        var buf = [];

        if ( typeof values === "object" ) {
            if ( fields ) values = objectPick( values, fields );

            for ( const field in values ) {

                // value is subquery
                if ( values[field] instanceof SQL ) {
                    const query = values[field];

                    if ( query.query ) {
                        buf.push( this.quoteId( field ) + " = (" + query.query + ")" );

                        this.#params.push( ...query.params );
                    }
                }

                // valie is parameter
                else {
                    buf.push( this.quoteId( field ) + " = " + PLACEHOLDER );

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

    // rows: {} || [{}]
    // fields: [String], "first", "full". "full" is default
    VALUES ( rows, fields ) {
        if ( typeof rows !== "object" ) throw Error( `SQL rows value is invalid` );

        if ( !Array.isArray( rows ) ) {
            if ( !objectIsPlain( rows ) ) throw Error( `SQL rows value is invalid` );

            rows = [rows];
        }

        if ( !Array.isArray( rows ) ) rows = [rows];

        // create fields index
        if ( !Array.isArray( fields ) ) {

            // build full fields index
            if ( !fields || fields === "full" ) {
                const idx = {};

                fields = [];

                for ( const row of rows ) {
                    for ( const field in row ) {
                        if ( idx[field] ) continue;

                        idx[field] = true;

                        fields.push( field );
                    }
                }
            }

            // build fields index from the first row only
            else if ( fields === "first" ) {
                fields = Object.keys( rows[0] );
            }
            else throw Error( `SQL fields value is invalid` );
        }

        const _rows = [];

        // create rows
        for ( const row of rows ) {
            const params = [];

            for ( const field of fields ) {
                const param = row[field];

                if ( param instanceof SQL ) {
                    if ( param.query ) {
                        params.push( "(" + param.query + ")" );

                        this.#params.push( ...param.params );
                    }
                }
                else {
                    params.push( PLACEHOLDER );

                    this.#params.push( param );
                }
            }

            _rows.push( "(" + params.join( ", " ) + ")" );
        }

        this.#query +=
            " (" +
            fields
                .map( field => {
                    return this.quoteId( field );
                } )
                .join( ", " ) +
            ") VALUES " +
            _rows.join( ", " );

        return this;
    }

    WHERE ( ...conditions ) {
        const query = this._parseConditions( conditions );

        if ( query ) {
            this.#query += " WHERE " + query[0];

            this.#params.push( ...query[1] );
        }

        return this;
    }

    ON ( ...conditions ) {
        const query = this._parseConditions( conditions );

        if ( query ) {
            this.#query += " WHERE " + query[0];

            this.#params.push( ...query[1] );
        }

        return this;
    }

    HAVING ( ...conditions ) {
        const query = this._parseConditions( conditions );

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
                        buf.push( PLACEHOLDER );

                        this.#params.push( val2 );
                    }
                }
            }
            else {
                buf.push( PLACEHOLDER );

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

    LIMIT ( value, options = {} ) {
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
            this.#query += " LIMIT " + PLACEHOLDER;

            this.#params.push( value );
        }

        return this;
    }

    OFFSET ( value ) {
        if ( value ) {
            if ( typeof value === "number" ) {
                this.#query += " OFFSET " + PLACEHOLDER;

                this.#params.push( value );
            }
            else {
                throw Error( `SQL offset value "${value}" is invalid` );
            }
        }

        return this;
    }
}

export function sql () {
    return new Query().sql( ...arguments );
}

sql.where = function ( ...args ) {
    return new Where( args );
};
