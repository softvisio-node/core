import Events from "#lib/events";

export default class WebSocket {
    #ws;
    #isBinary;
    #isConnected = true;
    #endCalled;
    #events = new Events();

    constructor ( ws ) {
        this.#ws = ws;
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

    // XXX
    end ( res ) {
        if ( !this.#isConnected || this.#endCalled ) return;

        this.#endCalled = true;

        this.#ws.end();
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

    _onClose ( res ) {
        this.#isConnected = false;

        this.#events.emit( "disconnect", res );
    }

    _onMessage ( data, isBinary ) {
        this.#isBinary = isBinary;

        this.#events.emit( "message", data, isBinary );
    }

    _onPing ( data ) {
        this.#events.emit( "ping", data );
    }

    _onPong ( data ) {
        this.#events.emit( "pong", data );
    }

    _onDrain () {}
}
