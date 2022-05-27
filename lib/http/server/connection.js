import Events from "#lib/events";

export default class Connection {
    #server;
    #ws;
    #minCompressLength;
    #isConnected = true;
    #endCalled;
    #events = new Events();

    constructor ( server, ws, { compress } = {} ) {
        this.#server = server;
        this.#ws = ws;

        // do not compress messages
        if ( !compress ) {
            this.#minCompressLength = Infinity;
        }

        // min length to compress
        else if ( typeof compress === "number" ) {
            this.#minCompressLength = compress;
        }

        // compress all messages
        else {
            this.#minCompressLength = 0;
        }
    }

    // properties
    get data () {
        return this.#ws.data;
    }

    get isConnected () {
        return this.#isConnected;
    }

    get getBufferedAmount () {
        return this.#ws.getBufferedAmount();
    }

    // public
    close () {
        if ( !this.#isConnected || this.#endCalled ) return;

        this.#endCalled = true;

        this.#ws.close();
    }

    end ( status, statusText ) {
        if ( !this.#isConnected || this.#endCalled ) return;

        this.#endCalled = true;

        this.#ws.end( status, statusText || result.getStatusText( status ) );
    }

    send ( data, isBinary, compress ) {
        if ( !this.#isConnected ) return;

        this.#ws.send( data, !!isBinary, compress ?? data.length >= this.#minCompressLength );
    }

    cork ( callback ) {
        this.#ws.cork( callback );

        return this;
    }

    on ( name, listener ) {
        this.#events.on( name, listener );
    }

    once ( name, listener ) {
        this.#events.once( name, listener );
    }

    off ( name, listener ) {
        this.#events.off( name, listener );
    }

    // protected
    _emit ( ...args ) {
        this.#events.emit( ...args );
    }

    _onClose ( res ) {
        this.#isConnected = false;

        this._onDisconnect( res );
    }

    _onDisconnect ( res ) {
        this.#events.emit( "disconnect", res );
    }

    _onMessage ( data, isBinary ) {
        this.#events.emit( "message", data, isBinary );
    }

    _onPing ( data ) {
        this.#events.emit( "ping", data );
    }

    _onPong ( data ) {
        this.#events.emit( "pong", data );
    }

    _onDrain () {
        this.#events.emit( "drain" );
    }
}
