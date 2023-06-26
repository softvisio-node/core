import Events from "#lib/events";
import result from "#lib/result";
import WebSocket from "#lib/websocket";
import Queue from "#lib/data/queue";

const WEBSOCKET_PROTOCOL = "jsonrpc_2.0";

// const WEBSOCKET_READYSTATE_CONNECTING = 0;
// const WEBSOCKET_READYSTATE_CLOSING = 2;
// const WEBSOCKET_READYSTATE_CLOSED = 3;
const WEBSOCKET_READYSTATE_OPEN = 1;

export default class ApiClientConnection extends Events {
    #api;
    #url;
    #hostname;
    #uploadUrl;
    #ref;

    #ws;
    #requestId = 0;
    #isConnecting = false;
    #isConnected = false; // connection is ready to send messages
    #isDestroyed = false;
    #queue = new Queue();
    #callbacks = {};
    #pongClearInterval;

    constructor ( api, url, hostname, ref ) {
        super();

        if ( typeof url === "string" ) url = new URL( url );

        this.#api = api;
        this.#url = url;
        this.#hostname = hostname || this.#url.hostname;
        this.#ref = ref;
    }

    // properties
    get id () {
        return this.#url.hostname;
    }

    get api () {
        return this.#api;
    }

    get hostname () {
        return this.#hostname;
    }

    get isBrowser () {
        return this.#api.isBrowser;
    }

    get token () {
        return this.#api.token;
    }

    get uploadUrl () {
        if ( !this.#uploadUrl ) {
            const url = new URL( this.api.uploadUrl );

            url.hostname = this.#url.hostname;

            this.#uploadUrl = url;
        }

        return this.#uploadUrl;
    }

    get isConnected () {
        return this.#isConnected;
    }

    get isDestroyed () {
        return this.#isDestroyed;
    }

    get isPending () {
        return !this.#isConnected && !this.#isDestroyed;
    }

    // public
    toString () {
        return this.#api.toString();
    }

    toJSON () {
        return this.#api.toJSON();
    }

    async ping () {
        const start = new Date(),
            res = await this.#call( "/ping" );

        res.meta.delay = new Date() - start;

        return res;
    }

    async checkHealthck () {
        return this.#call( "/check-health" );
    }

    publish ( name, ...args ) {
        this.#call( "/publish", [name, ...args], true );
    }

    async call ( method, ...args ) {
        return this.#call( method, args, false );
    }

    voidCall ( method, ...args ) {
        this.#call( method, args, true );
    }

    async cachedCall ( method, { key, maxAge }, ...args ) {
        var res;

        if ( key ) {
            key += "/" + method;

            res = this.#api.cache.get( key );

            if ( res ) return res;
        }

        res = await this.call( method, ...args );

        this.#api.cacheResult( res, key, maxAge );

        return res;
    }

    upload ( method, file, ...args ) {

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.api.version}/${method}`;
        }

        return new this.api.Upload( this, method, file, args );
    }

    disconnect () {
        if ( this.#ws ) this.#ws.close( 1000, "Normal Closure" );
    }

    startPong () {
        this.#stopPong();

        if ( this.#isDestroyed ) return;

        if ( !this.#api.pongInterval ) return;

        this.#pongClearInterval = setInterval( this.#pong.bind( this ), this.#api.pongInterval );

        if ( !this.isBrowser ) this.#pongClearInterval.unref();
    }

    ref () {
        if ( this.#ref ) return this;

        this.#ref = true;

        if ( !this.isBrowser ) this.#ws?._socket?.ref();

        return this;
    }

    unref () {
        if ( !this.#ref ) return this;

        this.#ref = false;

        if ( !this.isBrowser ) this.#ws?._socket?.unref();

        return this;
    }

    connect () {
        if ( this.#isConnecting ) return;

        this.#isConnecting = true;

        const protocol = [WEBSOCKET_PROTOCOL];
        if ( this.#api.token != null ) protocol.push( this.#api.token );

        if ( this.#url.hostname !== this.#hostname ) {
            this.#ws = new WebSocket( this.#url, protocol, {
                "servername": this.#hostname,
                "headers": { "Host": this.#hostname },
            } );
        }
        else {
            this.#ws = new WebSocket( this.#url, protocol );
        }

        this.#ws.binaryType = "arraybuffer";

        this.#ws.onerror = this.#onError.bind( this );
        this.#ws.onopen = this.#onOpen.bind( this );
        this.#ws.onclose = this.#onClose.bind( this );
        this.#ws.onmessage = this.#onMessage.bind( this );
    }

    // private
    // XXX signal
    async #call ( method, args, isVoid ) {
        var signal;

        if ( typeof method === "object" ) {
            ( { method, "arguments": args, signal } = method );
        }

        // add api version to the method
        if ( !method.startsWith( "/" ) ) method = `/${this.#api.version}/${method}`;

        // connection is closed
        if ( this.#isDestroyed ) {
            if ( isVoid ) {
                return;
            }
            else {
                return result( 1006 );
            }
        }

        const msg = {
            "jsonrpc": "2.0",
            method,
            "params": args,
        };

        if ( isVoid ) {

            // aborted
            if ( signal?.aborted ) return;

            this.#queue.push( msg );
            this.#sendQueue();
        }
        else {

            // aborted
            if ( signal?.aborted ) return result( -32817 );

            return new Promise( resolve => {
                msg.id = ++this.#requestId;
                msg.resolve = resolve;
                msg.signal = signal;

                this.#queue.push( msg );
                this.#sendQueue();
            } );
        }
    }

    #pong () {
        this.#call( "/pong", [], true );
    }

    #onError ( error ) {}

    #onOpen () {
        if ( !this.isBrowser && !this.#ref ) this.#ws._socket.unref();

        this.#isConnected = true;

        this.startPong();

        this.#sendQueue();

        this.emit( "connect", this );
    }

    #onClose ( e ) {
        this.#isDestroyed = true;
        this.#isConnected = false;
        this.#ws = null;

        this.#stopPong();

        this.emit( "disconnect", this, result( [e.code, e.reason] ) );

        // clear requsests queues
        this.#clearQueuedRequests( e.code, e.reason );
        this.#clearSentRequests( e.code, e.reason );
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
                return;
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

            // publish
            else if ( msg.method === "/publish" ) {
                if ( !msg.params[0] ) return;

                this.emit( "event", msg.params.shift(), msg.params );
            }

            // rpc
            else {

                // rpc calls are not supported
                if ( !this.#api.onRpc ) {
                    if ( msg.id ) this.#send( result( -32800 ).toJsonRpc( msg.id ) );
                }
                else {

                    // void call
                    if ( !msg.id ) {
                        this.#api.onRpc( msg.method, msg.params );
                    }

                    // regular call
                    else {
                        let res;

                        try {
                            res = result.try( await this.#api.onRpc( msg.method, msg.params ) );
                        }
                        catch ( e ) {
                            res = result.catch( e );
                        }

                        this.#send( res.toJsonRpc( msg.id ) );
                    }
                }
            }
        }

        // response
        else if ( msg.id ) {
            const callback = this.#callbacks[msg.id];

            if ( callback ) {
                delete this.#callbacks[msg.id];

                const res = result.fromJsonRpc( msg );

                // session is disabled
                if ( res.status === -32813 ) this.emit( "sessionDisabled" );

                // session was deleted
                if ( res.status === -32815 ) this.emit( "sessionDeleted" );

                // insufficient permissions
                if ( res.status === -32811 ) this.emit( "insufficientPermissions" );

                callback( res );
            }
        }
    }

    #sendQueue ( msg ) {

        // not connected, wait for connection
        if ( !this.#isConnected ) return;

        while ( this.#queue.length ) {
            if ( this.#isDestroyed ) return;

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
            this.#ws.send( JSON.stringify( msg ) );
        }
        else {
            this.#isDestroyed = true;
            this.#isConnected = false;
        }
    }

    #clearQueuedRequests ( status, statusText ) {
        const queue = this.#queue;

        this.#queue = new Queue();

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
