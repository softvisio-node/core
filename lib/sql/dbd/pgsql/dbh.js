const { Dbh } = require( "../../dbd" );
const net = require( "net" );
const { res } = require( "../../../result" );

module.exports = class DbhPgsql extends Dbh {
    #pool;
    #socket;
    #isConnected = false;
    #inTransaction = false;

    constructor ( pool, options ) {
        super();

        this.#pool = pool;

        this._connect( options );
    }

    async _connect ( options ) {
        this.#socket = net.connect( {
            "host": options.host,
            "port": options.port,
        } );

        // TODO
        this.#socket.once( "connect", () => {
            console.log( "CONNECTED" );

            this.#pool._pushDbh( this );
        } );

        this.#socket.on( "end", ( e ) => {
            console.log( e );
        } );

        this.#socket.on( "close", ( e ) => {
            console.log( e );
        } );

        this.#socket.on( "error", ( e ) => {
            const error = res( [500, e.message] );

            if ( this.#isConnected ) {
                this.#isConnected = false;
            }
            else {
            }
            console.log( error );
        } );
    }

    inTransaction () {
        return this.#inTransaction;
    }

    quote ( value ) {
        return this.#pool.quote( value );
    }

    isConnected () {
        return this.#isConnected;
    }

    // QUERY
    // TODO
    async do ( query, params ) {}

    // TODO
    async selectAll ( query, params ) {}

    // TODO
    async selectRow ( query, params ) {}
};
// -----SOURCE FILTER LOG BEGIN-----
//
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
// | Sev.  | Line:Col      | Rule                         | Description                                                                    |
// |=======+===============+==============================+================================================================================|
// | ERROR | 46:18         | no-empty                     | Empty block statement.                                                         |
// +-------+---------------+------------------------------+--------------------------------------------------------------------------------+
//
// -----SOURCE FILTER LOG END-----
