import Events from "#lib/events";

export default class Connection {
    #ws;
    #minCompressionLength;
    #isBinary;
    #isConnected = true;
    #endCalled;
    #events = new Events();

    constructor ( ws, { compressMessages = true } = {} ) {
        this.#ws = ws;

        if ( compressMessages === true ) this.#minCompressionLength = 0;
        else if ( compressMessages === false ) this.#minCompressionLength = Infinity;
        else this.#minCompressionLength = compressMessages;

        ws.onClose = this.#onDisconnect.bind( this );
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

        this.#ws.send( data, !!isBinary, compression ?? data.length >= this.#minCompressionLength );
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

    // private
    #onDisconnect ( res ) {
        this.#isConnected = false;

        this._onDisconnect( res );
    }

    #onMessage ( data, isBinary ) {
        this.#isBinary = isBinary;

        this._onMessage( data, isBinary );
    }

    #onPing ( data ) {
        this._onPing( data );
    }

    #onPong ( data ) {
        this._onPong( data );
    }

    #onDrain () {
        this._onDrain();
    }
}
