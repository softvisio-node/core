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
    #queue = [];
    #callbacks = {};
    #pongClearInterval;

    constructor ( api, hostname, url ) {
        super();

        this.#api = api;

        if ( typeof url === "string" ) url = new URL( url );

        const origHostname = url.hostname;
        url.hostname = hostname;

        this.#hostname = origHostname;
        this.#url = url;

        this.#connect( url );
    }

    get hostname () {
        return this.#hostname;
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
        this.#sendQueue( {
            "type": "pong",
        } );
    }

    // private
    async #connect () {
        const protocol = ["softvisio"];
        if ( this.#api.token != null ) protocol.push( this.#api.token );

        this.#ws = new WebSocket( this.#url, protocol, { "headers": { "Host": this.#hostname } } );

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

        this.#startPong();

        this.#sendQueue();

        this.emit( "open", this );
    }

    #onClose ( e ) {
        this.#stopPong();

        this.#ws = null;

        this.#isConnected = false;

        // clear requsests queues
        this.#clearPendingRequests();
        this.#clearSentRequests( e.code, e.reason );

        this.emit( "close", this, result( [e.code, e.reason] ) );

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
                        const ws = this.#ws;

                        let res;

                        try {
                            res = result.tryResult( await this.#api.onRPC( msg.method, msg.args ) );
                        }
                        catch ( e ) {
                            res = result.catchResult( e );
                        }

                        if ( ws.readyState === WEBSOCKET_READYSTATE_OPEN ) {
                            ws.send( this.#packMessage( {
                                "type": "rpc",
                                "id": msg.id,
                                "result": res,
                            } ) );
                        }
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

    // XXX return error, if not connected
    #sendQueue ( msg ) {
        if ( msg ) this.#queue.push( msg );

        if ( !this.#isConnected ) {
            return;
        }
        else {
            const ws = this.#ws;

            while ( this.#queue.length ) {
                if ( ws.readyState !== WEBSOCKET_READYSTATE_OPEN ) {
                    this.#isConnected = false;

                    return;
                }

                const msg = this.#queue.shift();

                if ( msg.resolve ) {
                    this.#callbacks[msg.id] = msg.resolve;

                    delete msg.resolve;
                }

                ws.send( this.#packMessage( msg ) );
            }
        }
    }

    #send ( msg ) {
        if ( this.#ws.readyState === WEBSOCKET_READYSTATE_OPEN ) {
            this.#ws.send( this.#packMessage( msg ) );
        }
        else {
            this.#isConnected = false;
        }
    }

    #close () {
        this.#isConnected = false;

        if ( this.#ws ) this.#ws.close( 1000, "Normal Closure" );
    }

    #clearPendingRequests () {
        const queue = this.#queue;

        this.#queue = [];

        for ( const msg of queue ) {
            if ( msg.resolve ) {
                msg.resolve( result( [500, "Disconnected"] ) );
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
    #startPong () {
        this.#stopPong();

        if ( !this.#api.pongInterval ) return;

        this.#pongClearInterval = setInterval( () => {
            this.#send( {
                "type": "pong",
            } );
        }, this.#api.pongInterval );
    }

    #stopPong () {
        if ( this.#pongClearInterval ) {
            clearInterval( this.#pongClearInterval );

            this.#pongClearInterval = null;
        }
    }

    #packMessage ( msg ) {
        return this.#api.json ? JSON.stringify( msg ) : MSGPACK.encode( msg );
    }
}
