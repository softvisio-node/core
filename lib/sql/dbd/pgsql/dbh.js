const { Dbh } = require( "../../dbd" );
const net = require( "net" );
const { res } = require( "../../../result" );
const { SQL_MAX_PARAMS_PGSQL } = require( "../../../const" );

module.exports = class DbhPgsql extends Dbh {
    isPgsql = true;

    #maxParams = SQL_MAX_PARAMS_PGSQL;
    #prepared = {};
    #pool;
    #socket;
    #isConnected = false;
    #inTransaction = false;

    constructor ( pool, options ) {
        super();

        this.#pool = pool;

        this._connect( options );
    }

    // TODO on cnnect - push
    // onerror
    // - if not connected - onDbhError
    // - if connected - pushDbh, call query callback, if exists
    async _connect ( options ) {
        this.#socket = net.connect( {
            "host": options.host,
            "port": options.port,
        } );

        // TODO
        this.#socket.once( "connect", () => {
            console.log( "CONNECTED" );

            this.#isConnected = true;
            this.#pool._pushDbh( this );
        } );

        this.#socket.on( "data", ( e ) => {
            console.log( "DATA", e.toString() );
        } );

        this.#socket.on( "close", ( e ) => {
            console.log( "CLOSE" );
        } );

        this.#socket.on( "error", ( e ) => {
            console.log( "ERROR" );
            const error = res( [500, e.message] );

            if ( this.#isConnected ) {
                this.#isConnected = false;

                this.#pool._pushDbh( this );
            }
            else {
                this.#pool._onDbhConnectError( error );
            }
        } );
    }

    inTransaction () {
        return this.#inTransaction;
    }

    quote ( value ) {
        return this.#pool.quote( value );
    }

    _isConnected () {
        return this.#isConnected;
    }

    // QUERY
    // TODO
    async do ( query, params ) {}

    // TODO
    async selectAll ( query, params ) {}

    // TODO
    async selectRow ( query, params ) {}

    _prepareQuery ( query, params ) {

        // query object
        if ( this.isQuery( query ) ) {
            query = query.getQuery( true );

            // override params
            if ( params ) query[1] = params;
        }

        // query is string
        else {

            // convert placeholders from "?" to "$1", only if query passed as string and has params
            if ( params ) {
                let n = 0;

                query = query.replace( /\?/g, () => ++n );
            }

            query = [query, params, null];
        }

        // serialize query if number of params exceeded
        if ( query[1] && query[1].length > this.#maxParams ) {
            return [this.queryToString( query[0], query[1] ), null, null];
        }
        else {
            return query;
        }
    }
};
