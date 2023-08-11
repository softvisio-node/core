import Events from "#lib/events";

export default class WebSocketConnection {
    #server;
    #ws;
    #compress;
    #isConnected = true;
    #events = new Events();
    #abortController = new AbortController();

    constructor ( server, ws, { compress } = {} ) {
        this.#server = server;
        this.#ws = ws;
        this.#compress = compress ?? this.#server.webSocketCompress;
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

    get abortSignal () {
        return this.#abortController.signal;
    }

    // public
    close () {
        if ( !this.#isConnected ) return;

        this.#isConnected = false;

        this.#ws.close();
    }

    disconnect ( res ) {
        if ( !this.#isConnected ) return;

        this.#isConnected = false;

        res ||= result( 1000 );

        this.#ws.end( res.status, res.statusText );
    }

    send ( data, isBinary, compress = this.#compress ) {
        if ( !this.#isConnected ) return;

        if ( typeof compress !== "boolean" ) compress = data.length >= compress;

        this.#ws.send( data, !!isBinary, compress );
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
    _onDisconnect ( res ) {
        this.#isConnected = false;

        this.#abortController.abort();

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

    // protected
    _emit ( ...args ) {
        this.#events.emit( ...args );
    }
}
