const { DbhPool } = require( "../dbd" );
const PgsqlDbh = require( "./pgsql/dbh" );
const { res } = require( "../../result" );
const { SQL_TYPE } = require( "../../const" );
const TYPES = require( "../dbi" ).TYPES.pgsql;
const util = require( "util" );

module.exports = class DbhPoolPgsql extends DbhPool {
    isPgsql = true;

    #options = {
        "host": null,
        "port": 5432,
        "username": null,
        "password": null,
        "db": null,
        "max": 3,
        "backLog": 1000,
    };

    #pool = [];
    #poolLength = 0;
    #getDbhQueue = [];

    constructor ( url, options ) {
        super( url, options );

        if ( !options ) options = {};

        for ( const option in this.#options ) {
            let urlOption = url[option];

            if ( option === "port" && urlOption === "" ) urlOption = null;

            const val = options[option] || url.searchParams.get( option ) || urlOption;

            if ( val != null ) this.#options[option] = val;
        }
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
                return "E'\\\\x" + param.toString( "hex" ) + "'";
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
    async _getDbh () {

        // try to get connected dbh from pool
        while ( this.#pool.length ) {
            const dbh = this.#pool.shift();

            // dbh found
            if ( dbh._isConnected() ) return res( 200, dbh );
        }

        // backlog is full
        if ( this.#poolLength >= this.#options.max ) return res( [500, "Dbh is not available"] );

        return new Promise( ( resolve ) => {

            // push resolver to the queue
            this.#getDbhQueue.push( resolve );

            // create new connection
            this._createDbh();
        } );
    }

    _onDbhConnectError ( res ) {
        this.#poolLength--;

        // return error status to the pending request
        if ( this.#getDbhQueue.length ) this.#getDbhQueue.shift()( res );

        // create new connection, if has pending requests
        if ( this.#getDbhQueue.length > this.#poolLength ) this._createDbh();
    }

    _onDbhReady ( dbh ) {
        if ( !dbh._isConnected() || dbh.inTransaction() ) {
            if ( dbh.inTransaction() ) console.error( `Unable to add dbh, that is in transaction state` );

            this.#poolLength--;

            // create new connection, if has pending requests
            if ( this.#getDbhQueue.length > this.#poolLength ) this._createDbh();
        }
        else {
            if ( this.#getDbhQueue.length ) {
                this.#getDbhQueue.shift()( res( 200, dbh ) );
            }
            else {
                this.#pool.push( dbh );
            }
        }
    }

    _createDbh () {

        // max number of connections is reached
        if ( this.#poolLength >= this.#options.max ) return;

        this.#poolLength++;

        new PgsqlDbh( this, this.#options );
    }

    // QUERY
    async do ( query, params ) {
        const dbh = await this._getDbh();

        if ( !dbh.isOk() ) return dbh;

        const result = dbh.data.do( query, params );

        this._onDbhReady( dbh.data );

        return result;
    }

    async selectAll ( query, params ) {
        const dbh = await this._getDbh();

        if ( !dbh.isOk() ) return dbh;

        const result = dbh.data.selectAll( query, params );

        this._onDbhReady( dbh.data );

        return result;
    }

    async selectRow ( query, params ) {
        const dbh = await this._getDbh();

        if ( !dbh.isOk() ) return dbh;

        const result = dbh.data.selectRow( query, params );

        this._onDbhReady( dbh.data );

        return result;
    }
};
