const { DbhPool } = require( "../dbd" );
const PgsqlDbh = require( "./pgsql/dbh" );
const { res } = require( "../../result" );

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
    #getDbh = [];

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

    // TODO
    quote ( value ) {
        return value;
    }

    // POOL
    async _getDbh () {

        // try to get connected dbh from pool
        while ( this.#pool.length ) {
            const dbh = this.#pool.shift();

            // dbh found
            if ( dbh.isConnected() ) return dbh;
        }

        // create new connection and postpone request
        if ( this.#poolLength < this.#options.max ) {
            this._createDbh();

            return new Promise( ( resolve ) => {
                this.#getDbh.push( resolve );
            } );
        }

        // postpone request
        else if ( this.#getDbh.length < this.#options.backLog ) {
            return new Promise( ( resolve ) => {
                this.#getDbh.push( resolve );
            } );
        }

        // max requests length is exceeded
        else {
            return res( [500, "Dbh handle is not available"] );
        }
    }

    _pushDbh ( dbh ) {
        if ( !dbh.isConnected() ) {
            this.#poolLength--;
        }
        else if ( dbh.inTransaction() ) {
            this.#poolLength--;

            console.error( `Unable to add dnf, that is in transaction state` );
        }
        else {
            this.#pool.push( dbh );
        }

        if ( this.#getDbh.length ) {
            const getDbh = this.#getDbh.shift();

            getDbh( dbh );
        }
        else {
            this.#pool.push( dbh );
        }
    }

    _createDbh () {
        if ( this.#poolLength >= this.#options.max ) return;

        this.#poolLength++;

        const dbh = new PgsqlDbh( this, this.#options );
    }

    // QUERY
    async do ( query, params ) {
        const dbh = await this._getDbh();

        if ( !dbh.isOk() ) return dbh;

        const result = dbh.data.do( query, params );

        this._pushDbh( dbh.data );

        return result;
    }

    async selectAll ( query, params ) {
        const dbh = await this._getDbh();

        if ( !dbh.isOk() ) return dbh;

        const result = dbh.data.selectAll( query, params );

        this._pushDbh( dbh.data );

        return result;
    }

    async selectRow ( query, params ) {
        const dbh = await this._getDbh();

        if ( !dbh.isOk() ) return dbh;

        const result = dbh.data.selectRow( query, params );

        this._pushDbh( dbh.data );

        return result;
    }
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 108:15        | no-unused-vars               | 'dbh' is assigned a value but never used.                                      |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
