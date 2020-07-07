const { DbhPool } = require( "../dbd" );
const PgsqlDbh = require( "./pgsql/dbh" );
const { SQL_TYPE } = require( "../../const" );
const TYPES = require( "../dbi" ).TYPES.pgsql;
const util = require( "util" );
const { Where, Query } = require( "../dbi" );

class DbdWhere extends Where {
    _getLikeOperator () {
        return "ILIKE";
    }
}

class DbdQuery extends Query {
    _getLikeOperator () {
        return "ILIKE";
    }
}

module.exports = class DbhPoolPgsql extends DbhPool {
    isPgsql = true;

    #options = {
        "host": null,
        "port": 5432,
        "path": null,
        "username": null,
        "password": null,
        "db": null,
        "max": 10,
    };

    #pool = [];
    #slots = 10;

    constructor ( url, options ) {
        super( url, options );

        if ( !options ) options = {};

        for ( const option in this.#options ) {
            let urlOption = url[option];

            if ( option === "port" && urlOption === "" ) urlOption = null;

            if ( option === "path" ) urlOption = url.pathname;

            const val = options[option] || url.searchParams.get( option ) || urlOption;

            if ( val != null ) this.#options[option] = val;
        }

        this.#slots = this.#options.max;
    }

    WHERE ( ...args ) {
        return new DbdWhere( args );
    }

    sql () {
        return new DbdQuery().sql( ...arguments );
    }

    inTransaction () {
        return false;
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
                return "'" + param.replace( /'/g, "''" ) + "'";
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
            // https://www.postgresql.org/docs/current/static/datatype-binary.html
            else if ( Buffer.isBuffer( param ) ) {
                return "'\\x" + param.toString( "hex" ) + "'";
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

    // POOL
    _getDbh ( forTransaction ) {
        let dbh;

        if ( this.#slots ) {
            this.#slots--;

            dbh = new PgsqlDbh( this, this.#options );
        }
        else {
            dbh = this.#pool.shift();
        }

        if ( !forTransaction ) this.#pool.push( dbh );

        return dbh;
    }

    _onDbhError () {
        this.#pool = this.#pool.filter( dbh => {
            if ( dbh._isDestroyed() ) {
                this.#slots++;

                return false;
            }
            else {
                return true;
            }
        } );
    }

    _pushDbh ( dbh ) {
        if ( dbh._isDestroyed() ) {
            this.#slots++;
        }
        else if ( dbh.inTransaction() ) {
            this.#slots++;

            dbh._destroy();
        }
        else {
            this.#pool.push( dbh );
        }
    }

    // QUERY
    async exec ( query, params ) {
        return this._getDbh().exec( query, params );
    }

    async do ( query, params ) {
        return this._getDbh().do( query, params );
    }

    async selectAll ( query, params ) {
        return this._getDbh().selectAll( query, params );
    }

    async selectRow ( query, params ) {
        return this._getDbh().selectRow( query, params );
    }
};
