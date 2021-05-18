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
    #isConnected = false; // connection is ready to send messages
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

    get api () {
        return this.#api;
    }

    get hostname () {
        return this.#hostname;
    }

    get isConnected () {
        return this.#isConnected;
    }

    get isClosed () {
        return this.#isClosed;
    }

    // public
    async call ( method, ...args ) {

        // add api version to the method
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.#api.version}/${method}`;
        }

        if ( !args.length ) args = undefined;

        return new Promise( resolve => {
            this.#sendQueue( {
                "type": "rpc",
                "id": ++this.#requestId,
                method,
                args,
                resolve,
            } );
        } );
    }

    async callVoid ( method, ...args ) {

        // add api version to the method
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.#api.version}/${method}`;
        }

        if ( !args.length ) args = undefined;

        this.#sendQueue( {
            "type": "rpc",
            method,
            args,
        } );
    }

    publish ( name, ...args ) {
        this.#sendQueue( {
            "type": "event",
            name,
            args,
        } );

        return true;
    }

    async ping () {
        return new Promise( resolve => {
            const start = new Date();

            this.#sendQueue( {
                "type": "ping",
                "id": ++this.#requestId,
                "resolve": res => {
                    res.delay = new Date() - start;

                    resolve( res );
                },
            } );
        } );
    }

    pong () {
        if ( this.#isClosed ) return;

        this.#sendQueue( {
            "type": "pong",
        } );
    }

    close () {
        this.#isClosed = true;
        this.#isConnected = false;

        if ( this.#ws ) this.#ws.close( 1000, "Normal Closure" );
    }

    startPong () {
        this.#stopPong();

        if ( this.#isClosed ) return;

        if ( !this.#api.pongInterval ) return;

        this.#pongClearInterval = setInterval( () => {
            this.#send( {
                "type": "pong",
            } );
        }, this.#api.pongInterval );
    }

    // private
    async #connect () {
        const protocol = ["softvisio"];
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
        this.#isConnected = true;

        this.startPong();

        this.#sendQueue();

        this.emit( "open", this );
    }

    #onClose ( e ) {
        this.#stopPong();

        this.#ws = null;

        this.#isClosed = true;
        this.#isConnected = false;

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

        // ping
        if ( msg.type === "ping" ) {

            // send pong, if required
            if ( msg.id ) this.#send( { "type": "pong", "id": msg.id } );
        }
        else if ( msg.type === "pong" ) {
            if ( msg.id ) {
                const callback = this.#callbacks[msg.id];

                if ( callback ) {
                    delete this.#callbacks[msg.id];

                    callback( result( 200 ) );
                }
            }
        }

        // event
        else if ( msg.type === "event" ) {
            this.emit( "event", msg.name, msg.args );
        }

        // rpc
        else if ( msg.type === "rpc" ) {

            // rpc request
            if ( msg.method ) {

                // rpc calls are not supported
                if ( !this.#api.onRPC ) {

                    // return error if not is void call
                    if ( msg.id ) {
                        this.#send( {
                            "type": "rpc",
                            "id": msg.id,
                            "result": {
                                "status": 400,
                                "reason": "RPC calls are not supported",
                            },
                        } );
                    }
                }
                else {

                    // void call
                    if ( !msg.id ) {
                        this.#api.onRPC( msg.method, msg.args );
                    }

                    // regular call
                    else {
                        let res;

                        try {
                            res = result.tryResult( await this.#api.onRPC( msg.method, msg.args ) );
                        }
                        catch ( e ) {
                            res = result.catchResult( e );
                        }

                        this.#send( {
                            "type": "rpc",
                            "id": msg.id,
                            "result": res,
                        } );
                    }
                }
            }

            // rpc response
            else {
                const callback = this.#callbacks[msg.id];

                if ( callback ) {
                    delete this.#callbacks[msg.id];

                    callback( result.parseResult( msg.result ) );
                }
            }
        }
    }

    #sendQueue ( msg ) {
        if ( msg ) this.#queue.push( msg );

        // connection is closed
        if ( this.#isClosed ) {
            this.#clearQueuedRequests( 1006 ); // 1006 - Abnormal Closure
        }

        // not connected, wait for connection
        else if ( !this.#isConnected ) {
            return;
        }

        // connected
        else {
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
    }

    #send ( msg ) {
        if ( this.#ws.readyState === WEBSOCKET_READYSTATE_OPEN ) {
            this.#ws.send( this.#api.json ? JSON.stringify( msg ) : MSGPACK.encode( msg ) );
        }
        else {
            this.#isClosed = true;
            this.#isConnected = false;
        }
    }

    #clearQueuedRequests ( status, reason ) {
        const queue = this.#queue;

        this.#queue = [];

        for ( const msg of queue ) {
            if ( msg.resolve ) {
                msg.resolve( result( [status, reason] ) );
            }
        }
    }

    #clearSentRequests ( status, reason ) {
        const callbacks = this.#callbacks;

        this.#callbacks = {};

        for ( const id in callbacks ) {
            callbacks[id]( result( [status, reason] ) );
        }
    }

    // pong
    #stopPong () {
        if ( this.#pongClearInterval ) {
            clearInterval( this.#pongClearInterval );

            this.#pongClearInterval = null;
        }
    }
}
