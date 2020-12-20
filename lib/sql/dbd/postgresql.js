const { DbhPool } = require( "../dbd" );
const PostgresqlDbh = require( "./postgresql/dbh" );
const { SQL_TYPE } = require( "../../const" );
const TYPES = require( "../dbi" ).TYPES.postgresql;
const util = require( "util" );
const { Where, Query } = require( "../dbi" );

const DEFAULT_SLOTS = 3;

class DbdWhere extends Where {
    get _likeOperator () {
        return "ILIKE";
    }
}

class DbdQuery extends Query {
    get _likeOperator () {
        return "ILIKE";
    }
}

module.exports = class DbhPoolPostgresql extends DbhPool {
    #options = {
        "host": "",
        "port": 5432,
        "path": "",
        "username": "",
        "password": "",
        "database": "",
    };

    #pool = [];
    #slots = 10;

    constructor ( url, options = {} ) {
        super( url, options );

        if ( options.host || url.hostname ) {
            this.#options.host = options.host || url.hostname;

            this.#options.port = options.port || url.port || this.#options.port;

            this.#options.username = options.username ?? url.username;
            this.#options.password = options.password ?? url.password;

            this.#options.database = options.database ?? url.pathname.substr( 1 );
        }
        else {

            // XXX authorization is not possible
            // XXX how to split socket path to path and database in case if database is not provided???
            throw `Postgres connect using unix socket is not supported`;
        }

        this.#slots = options.max || url.searchParams.get( "max" ) || DEFAULT_SLOTS;
    }

    get isPostgresql () {
        return true;
    }

    get type () {
        return "postgresql";
    }

    get inTransaction () {
        return false;
    }

    WHERE ( ...args ) {
        return new DbdWhere( args );
    }

    sql () {
        return new DbdQuery().sql( ...arguments );
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

            dbh = new PostgresqlDbh( this, this.#options );
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
        else if ( dbh.inTransaction ) {
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
