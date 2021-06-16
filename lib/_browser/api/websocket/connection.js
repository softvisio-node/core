import Events from "#lib/events";
import MSGPACK from "#lib/msgpack";
import result from "#lib/result";
import WebSocket from "#lib/websocket";

// const WEBSOCKET_READYSTATE_CONNECTING = 0;
// const WEBSOCKET_READYSTATE_CLOSING = 2;
// const WEBSOCKET_READYSTATE_CLOSED = 3;
const WEBSOCKET_READYSTATE_OPEN = 1;

export default class Connection extends Events {
    #api;
    #hostname;
    #url;

    #ws;
    #requestId = 0;
    #isOpen = false; // connection is ready to send messages
    #isClosed = false;
    #queue = [];
    #callbacks = {};
    #pongClearInterval;

    constructor ( api, url, hostname ) {
        super();

        if ( typeof url === "string" ) url = new URL( url );

        this.#api = api;
        this.#url = url;
        this.#hostname = hostname || url.hostname;

        this.#connect();
    }

    // properties
    get api () {
        return this.#api;
    }

    get hostname () {
        return this.#hostname;
    }

    get isOpen () {
        return this.#isOpen;
    }

    get isClosed () {
        return this.#isClosed;
    }

    // public
    async ping () {
        const start = new Date(),
            res = await this.#call( "/ping" );

        res.delay = new Date() - start;

        return res;
    }

    async healthcheck () {
        return this.#call( "/healthcheck" );
    }

    publish ( name, ...args ) {
        this.#call( "/event", [name, ...args], true );
    }

    async call ( method, ...args ) {

        // add api version to the method
        if ( method.charAt( 0 ) !== "/" ) method = `/${this.#api.version}/${method}`;

        return this.#call( method, args );
    }

    callVoid ( method, ...args ) {

        // add api version to the method
        if ( method.charAt( 0 ) !== "/" ) method = `/${this.#api.version}/${method}`;

        this.#call( method, args, true );
    }

    close () {
        this.#isClosed = true;
        this.#isOpen = false;

        if ( this.#ws ) this.#ws.close( 1000, "Normal Closure" );
    }

    startPong () {
        this.#stopPong();

        if ( this.#isClosed ) return;

        if ( !this.#api.pongInterval ) return;

        this.#pongClearInterval = setInterval( this.#pong.bind( this ), this.#api.pongInterval );
    }

    // private
    async #call ( method, args, isVoid ) {

        // connection is closed
        if ( this.#isClosed ) {
            if ( isVoid ) return;
            else return result( 1006 );
        }

        const msg = {
            "jsonrpc": "2.0",
            method,
            "params": args,
        };

        if ( isVoid ) {
            this.#queue.push( msg );
            this.#sendQueue();
        }
        else {
            return new Promise( resolve => {
                msg.id = ++this.#requestId;
                msg.resolve = resolve;

                this.#queue.push( msg );
                this.#sendQueue();
            } );
        }
    }

    #pong () {
        this.#call( "/pong", [], true );
    }

    async #connect () {
        const protocol = ["rpc"];
        if ( this.#api.token != null ) protocol.push( this.#api.token );

        if ( this.#url.hostname !== this.#hostname ) {
            this.#ws = new WebSocket( this.#url, protocol, { "headers": { "Host": this.#hostname } } );
        }
        else {
            this.#ws = new WebSocket( this.#url, protocol );
        }

        this.#ws.onerror = this.#onError.bind( this );
        this.#ws.onopen = this.#onOpen.bind( this );
        this.#ws.onclose = this.#onClose.bind( this );
        this.#ws.onmessage = this.#onMessage.bind( this );

        // XXX browser specific
        this.#ws.binaryType = "arraybuffer";
    }

    #onError ( error ) {}

    #onOpen () {
        this.#isOpen = true;

        this.startPong();

        this.#sendQueue();

        this.emit( "open", this );
    }

    #onClose ( e ) {
        this.#stopPong();

        this.#ws = null;

        this.#isClosed = true;
        this.#isOpen = false;

        this.emit( "close", this, result( [e.code, e.reason] ) );

        // clear requsests queues
        this.#clearQueuedRequests( e.code, e.reason );
        this.#clearSentRequests( e.code, e.reason );

        this.removeAllListeners();
    }

    async #onMessage ( msg ) {

        // decode message
        try {

            // text message
            if ( typeof msg.data === "string" ) {
                msg = JSON.parse( msg.data );
            }

            // binary message
            else {
                msg = MSGPACK.decode( msg.data );
            }
        }
        catch ( e ) {
            return;
        }

        // request
        if ( msg.method ) {
            if ( !Array.isArray( msg.params ) ) msg.params = msg.params === undefined ? [] : [msg.params];

            // ping
            if ( msg.method === "/ping" ) {

                // response with the pong, if required
                if ( msg.id ) {
                    this.#send( {
                        "jsonrpc": "2.0",
                        "id": msg.id,
                        "method": "/pong",
                    } );
                }
            }

            // pong
            else if ( msg.method === "/pong" ) {
                if ( msg.id ) {
                    const callback = this.#callbacks[msg.id];

                    if ( callback ) {
                        delete this.#callbacks[msg.id];

                        callback( result( 200 ) );
                    }
                }
            }

            // event
            else if ( msg.method === "/event" ) {
                const name = msg.params.shift();

                if ( !name ) return;

                this.emit( "event", name, msg.params );
                this.emit( "event/" + name, ...msg.params );
            }

            // rpc
            else {

                // rpc calls are not supported
                if ( !this.#api.onRPC ) {
                    if ( msg.id ) this.#send( result( -32800 ).toRPC( msg.id ) );
                }
                else {

                    // void call
                    if ( !msg.id ) {
                        this.#api.onRPC( msg.method, msg.params );
                    }

                    // regular call
                    else {
                        let res;

                        try {
                            res = result.try( await this.#api.onRPC( msg.method, msg.params ) );
                        }
                        catch ( e ) {
                            res = result.catch( e );
                        }

                        this.#send( res.toRPC( msg.id ) );
                    }
                }
            }
        }

        // response
        else if ( msg.id ) {
            const callback = this.#callbacks[msg.id];

            if ( callback ) {
                delete this.#callbacks[msg.id];

                callback( result.parseRPC( msg ) );
            }
        }
    }

    #sendQueue ( msg ) {

        // not connected, wait for connection
        if ( !this.#isOpen ) return;

        while ( this.#queue.length ) {
            if ( this.#isClosed ) return;

            const msg = this.#queue.shift();

            if ( msg.resolve ) {
                this.#callbacks[msg.id] = msg.resolve;

                delete msg.resolve;
            }

            this.#send( msg );
        }
    }

    #send ( msg ) {
        if ( this.#ws.readyState === WEBSOCKET_READYSTATE_OPEN ) {
            this.#ws.send( this.#api.json ? JSON.stringify( msg ) : MSGPACK.encode( msg ) );
        }
        else {
            this.#isClosed = true;
            this.#isOpen = false;
        }
    }

    #clearQueuedRequests ( status, statusText ) {
        const queue = this.#queue;

        this.#queue = [];

        for ( const msg of queue ) {
            if ( msg.resolve ) {
                msg.resolve( result( [status, statusText] ) );
            }
        }
    }

    #clearSentRequests ( status, statusText ) {
        const callbacks = this.#callbacks;

        this.#callbacks = {};

        for ( const id in callbacks ) {
            callbacks[id]( result( [status, statusText] ) );
        }
    }

    #stopPong () {
        if ( this.#pongClearInterval ) {
            clearInterval( this.#pongClearInterval );

            this.#pongClearInterval = null;
        }
    }
}
