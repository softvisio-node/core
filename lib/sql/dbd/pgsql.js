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
