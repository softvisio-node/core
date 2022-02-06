import Events from "#lib/events";

export default class WebSocket {
    #ws;
    #isBinary;
    #isConnected = true;
    #endCalled;
    #events = new Events();

    constructor ( ws ) {
        this.#ws = ws;

        ws.onClose = this.#onClose.bind( this );
        ws.onMessage = this.#onMessage.bind( this );
        ws.onPing = this.#onPing.bind( this );
        ws.onPong = this.#onPong.bind( this );
        ws.onDrain = this.#onDrain.bind( this );
    }

    // properties
    get data () {
        return this.#ws.data;
    }

    get isBinary () {
        return this.#isBinary;
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

    send ( data, isBinary, compression ) {
        if ( !this.#isConnected ) return;

        this.#ws.send( data, !!isBinary, !!compression );
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

    // private
    #onClose ( res ) {
        this.#isConnected = false;

        this.#events.emit( "disconnect", res );
    }

    #onMessage ( data, isBinary ) {
        this.#isBinary = isBinary;

        this.#events.emit( "message", data, isBinary );
    }

    #onPing ( data ) {
        this.#events.emit( "ping", data );
    }

    #onPong ( data ) {
        this.#events.emit( "pong", data );
    }

    #onDrain () {
        this.#events.emit( "drain" );
    }
}
