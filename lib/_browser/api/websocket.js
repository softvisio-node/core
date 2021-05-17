import Http from "./http.js";
import MSGPACK from "#lib/msgpack";
import result from "#lib/result";
import WebSocket from "#lib/websocket";

// const WEBSOCKET_READYSTATE_CONNECTING = 0;
// const WEBSOCKET_READYSTATE_CLOSING = 2;
// const WEBSOCKET_READYSTATE_CLOSED = 3;
const WEBSOCKET_READYSTATE_OPEN = 1;

export default class extends Http {
    #websocketUrl;
    #onRpc; // async function( method, args )
    #eventNamePrefix;

    #ws;
    #requestId = 0;
    #isConnected = false; // connection is ready to send messages
    #queue = [];
    #callbacks = {};
    #pongClearInterval;

    constructor ( options ) {
        super( options );

        this.#eventNamePrefix = options.eventNamePrefix ?? true;
        this.#onRpc = options.onRpc;
    }

    get websocketUrl () {
        if ( !this.#websocketUrl ) {
            const url = new URL( this.url );

            if ( url.protocol === "http:" ) url.protocol = "ws:";
            else if ( url.protocol === "https:" ) url.protocol = "wss:";

            url.username = "";
            url.password = "";
            url.search = "";
            url.hash = "";

            this.#websocketUrl = url;
        }

        return this.#websocketUrl;
    }

    set url ( value ) {
        super.url = null;

        this.#websocketUrl = null;

        // close connection if url was updated
        this.#close();
    }

    set token ( value ) {

        // close connection if token was updated
        this.#close();
    }

    set persistent ( value ) {
        if ( this.persistent ) this._connectWebSocket();
        else this.#close();
    }

    set pongInterval ( value ) {
        this.#startPong();
    }

    // public
    async call ( method, ...args ) {

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.version}/${method}`;
        }

        if ( !args.length ) args = undefined;

        if ( !this.persistent ) return super._callHTTP( method, args );

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

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.version}/${method}`;
        }

        if ( !args.length ) args = undefined;

        if ( !this.persistent ) return super._callVoidHTTP( method, args );

        this.#sendQueue( {
            "type": "rpc",
            method,
            args,
        } );
    }

    publish ( name, ...args ) {
        if ( !this.persistent ) return false;

        this.#sendQueue( {
            "type": "event",
            name,
            args,
        } );

        return true;
    }

    async ping () {
        if ( !this.persistent ) return;

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
        if ( !this.persistent ) return;

        this.#sendQueue( {
            "type": "pong",
        } );
    }

    // protected
    async _connectWebSocket () {
        if ( !this.persistent ) return;

        // do nothing if connection is already created
        if ( this.#ws ) return;

        const protocol = ["softvisio"];
        if ( this.token != null ) protocol.push( this.token );

        this.#ws = new WebSocket( this.websocketUrl, protocol, {} );

        this.#ws.onerror = this.#onError.bind( this );
        this.#ws.onopen = this.#onOpen.bind( this );
        this.#ws.onclose = this.#onClose.bind( this );
        this.#ws.onmessage = this.#onMessage.bind( this );

        // XXX browser specific
        this.#ws.binaryType = "arraybuffer";
    }

    // private
    #onError ( error ) {}

    #onOpen () {
        this.#isConnected = true;

        this.#startPong();

        this.#sendQueue();

        this.emit( "open" );
    }

    #onClose ( e ) {
        this.#stopPong();

        this.#ws = null;

        this.#isConnected = false;

        // clear requsests queues
        this.#clearPendingRequests();
        this.#clearSentRequests( e.code, e.reason );

        this.emit( "close", result( [e.code, e.reason] ) );

        // reconnect
        this._connectWebSocket();
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

            if ( this.#eventNamePrefix ) this.emit( "event/" + msg.name, ...msg.args );
        }

        // rpc
        else if ( msg.type === "rpc" ) {

            // rpc request
            if ( msg.method ) {

                // rpc calls are not supported
                if ( !this.#onRpc ) {

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
                        this.#onRpc( msg.method, msg.args );
                    }

                    // regular call
                    else {
                        const ws = this.#ws;

                        let res;

                        try {
                            res = result.tryResult( await this.#onRpc( msg.method, msg.args ) );
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

    #sendQueue ( msg ) {
        if ( msg ) this.#queue.push( msg );

        if ( !this.#isConnected ) {
            this._connectWebSocket();
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

        if ( !this.persistent ) return;

        if ( !this.pongInterval ) return;

        this.#pongClearInterval = setInterval( () => {
            this.#send( {
                "type": "pong",
            } );
        }, this.pongInterval );
    }

    #stopPong () {
        if ( this.#pongClearInterval ) {
            clearInterval( this.#pongClearInterval );

            this.#pongClearInterval = null;
        }
    }

    #packMessage ( msg ) {
        return this.json ? JSON.stringify( msg ) : MSGPACK.encode( msg );
    }
}
