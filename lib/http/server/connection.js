import Events from "#lib/events";

export default class Connection {
    #server;
    #ws;
    #compress;
    #isConnected = true;
    #events = new Events();

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

    // public
    close () {
        if ( !this.#isConnected ) return;

        this.#isConnected = false;

        this.#ws.close();
    }

    disconnect ( status, statusText ) {
        if ( !this.#isConnected ) return;

        this.#isConnected = false;

        this.#ws.end( status, statusText || result.getStatusText( status ) );
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

    onConnect () {}

    onDisconnect ( res ) {
        this.#isConnected = false;

        this.#events.emit( "disconnect", res );
    }

    onMessage ( data, isBinary ) {
        this.#events.emit( "message", data, isBinary );
    }

    onPing ( data ) {
        this.#events.emit( "ping", data );
    }

    onPong ( data ) {
        this.#events.emit( "pong", data );
    }

    onDrain () {
        this.#events.emit( "drain" );
    }

    // protected
    _emit ( ...args ) {
        this.#events.emit( ...args );
    }
}
