import result from "#lib/result";
import Events from "#lib/events";
import Queue from "#lib/data-structures/queue";
import isBrowser from "#lib/is-browser";

// XXX remove
import WebSocket from "#lib/websocket";

const WEBSOCKET_PROTOCOL = "jsonrpc_2.0";

// const WEBSOCKET_READYSTATE_CONNECTING = 0;
// const WEBSOCKET_READYSTATE_CLOSING = 2;
// const WEBSOCKET_READYSTATE_CLOSED = 3;
const WEBSOCKET_READYSTATE_OPEN = 1;

const SYSTEM_EVENTS = new Set( [ "sessionDisable", "sessionDelete", "sessionReload" ] );

export default class ApiClientConnection extends Events {
    #api;
    #url;
    #uploadUrl;
    #ref;

    #ws;
    #requestId = 0;
    #isConnecting = false;
    #isConnected = false; // connection is ready to send messages
    #isDestroyed = false;
    #queue = new Queue();
    #callbacks = {};
    #responseSymbol;

    constructor ( api, url ) {
        super();

        if ( typeof url === "string" ) url = new URL( url );

        this.#api = api;
        this.#url = url;
        this.#ref = api.hasRef;
    }

    // properties
    get id () {
        return this.#url.hostname;
    }

    get api () {
        return this.#api;
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

    get isConnecting () {
        return !this.#isConnected && !this.#isDestroyed;
    }

    get isConnected () {
        return this.#isConnected;
    }

    get isDestroyed () {
        return this.#isDestroyed;
    }

    get hasRef () {
        return this.#ref;
    }

    // public
    // XXX
    connect () {
        if ( this.#isConnecting ) return;

        this.#isConnecting = true;

        const protocols = [ WEBSOCKET_PROTOCOL ];
        if ( this.#api.token != null ) protocols.push( this.#api.token );

        if ( isBrowser ) {
            this.#ws = new WebSocket( this.#url, protocols );
        }

        // XXX remove
        else if ( WebSocket !== global.WebSocket ) {
            this.#ws = new WebSocket( this.#url, protocols, {
                "rejectUnauthorized": this.#api.checkCertificate,
                "servername": this.#api.tlsServerName,
                "headers": {
                    "Host": this.#api.tlsServerName,
                },
            } );
        }
        else {

            // XXX Host is not applied
            // XXX https://github.com/nodejs/node/issues/54403
            this.#ws = new WebSocket( this.#url, {
                protocols,
                "headers": {
                    "Host": this.#api.hostname,
                },
            } );
        }

        this.#ws.binaryType = "arraybuffer";

        this.#ws.onerror = this.#onError.bind( this );
        this.#ws.onopen = this.#onOpen.bind( this );
        this.#ws.onclose = this.#onClose.bind( this );
        this.#ws.onmessage = this.#onMessage.bind( this );
    }

    disconnect () {
        if ( this.#ws ) this.#ws.close( 1000, "Normal Closure" );
    }

    publish ( name, ...args ) {
        this.#call( "/publish", [ name, ...args ], true );
    }

    async call ( method, ...args ) {
        return this.#call( method, args, false );
    }

    voidCall ( method, ...args ) {
        this.#call( method, args, true );
    }

    async cachedCall ( method, ...args ) {
        var key, maxAge, signal;

        if ( typeof method === "object" ) {
            ( { method, "arguments": args, key, maxAge, signal } = method );
        }

        key = method + "/" + ( key ?? "" );

        var res = this.#api.cache.get( key );

        if ( res ) return res;

        res = await this.call( {
            method,
            "arguments": args,
            signal,
        } );

        this.#api.cacheResult( res, key, maxAge );

        return res;
    }

    upload ( method, file, ...args ) {

        // add api version to nethod
        if ( !method.startsWith( "/" ) ) {
            method = `/v${ this.api.version }/${ method }`;
        }

        return new this.api.Upload( this, method, file, args );
    }

    ref () {
        if ( this.#ref ) return this;

        this.#ref = true;

        this.#socket?.ref();

        return this;
    }

    unref () {
        if ( !this.#ref ) return this;

        this.#ref = false;

        this.#socket?.unref();

        return this;
    }

    toString () {
        return this.#api.toString();
    }

    toJSON () {
        return this.#api.toJSON();
    }

    // private
    async #call ( method, args, isVoid ) {
        var signal;

        if ( typeof method === "object" ) {
            ( { method, "arguments": args, signal } = method );
        }

        // aborted
        if ( signal?.aborted ) return result( -32817 );

        // connection is closed
        if ( this.#isDestroyed ) {
            if ( isVoid ) {
                return;
            }
            else {
                return result( 1006 );
            }
        }

        // add api version to the method
        if ( !method.startsWith( "/" ) ) method = `/v${ this.#api.version }/${ method }`;

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
                const id = ++this.#requestId;

                msg.id = id;

                if ( signal ) {
                    msg.signal = signal;

                    const listener = () => {

                        // message was sent
                        if ( this.#callbacks[ id ] ) {
                            delete this.#callbacks[ id ];

                            // send abort call
                            this.#call( "/abort", [ id ], true );
                        }

                        // aborted
                        resolve( result( -32817 ) );
                    };

                    signal.addEventListener( "abort", listener, { "once": true } );

                    msg.resolve = res => {
                        signal.removeEventListener( "abort", listener );

                        resolve( res );
                    };
                }
                else {
                    msg.resolve = resolve;
                }

                this.#queue.push( msg );
                this.#sendQueue();
            } );
        }
    }

    #onError ( e ) {}

    #onOpen () {
        if ( !this.#ref ) this.#socket?.unref();

        this.#isConnected = true;

        this.#sendQueue();

        this.emit( "connect", this );
    }

    #onClose ( e ) {
        this.#isDestroyed = true;
        this.#isConnected = false;
        this.#ws = null;

        this.emit( "disconnect", this, result( [ e.code, e.reason ] ) );

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
            if ( !Array.isArray( msg.params ) ) msg.params = msg.params === undefined ? [] : [ msg.params ];

            // publish
            if ( msg.method === "/publish" ) {
                const name = msg.params.shift();

                if ( !name ) {
                    return;
                }
                else if ( SYSTEM_EVENTS.has( name ) ) {
                    this.emit( name );
                }
                else {
                    this.emit( "event", name, msg.params );
                }
            }

            // session disabled

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
            const callback = this.#callbacks[ msg.id ];

            if ( callback ) {
                delete this.#callbacks[ msg.id ];

                const res = result.fromJsonRpc( msg );

                // session is disabled
                if ( res.status === -32813 ) this.emit( "sessionDisable" );

                // session was deleted
                if ( res.status === -32815 ) this.emit( "sessionDelete" );

                // access denied
                if ( res.status === -32811 ) this.emit( "accessDenied" );

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

            // skip aborted message
            if ( msg.signal?.aborted ) continue;

            if ( msg.resolve ) {
                this.#callbacks[ msg.id ] = msg.resolve;

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

            // skip aborted message
            if ( msg.signal?.aborted ) continue;

            if ( msg.resolve ) {
                msg.resolve( result( [ status, statusText ] ) );
            }
        }
    }

    #clearSentRequests ( status, statusText ) {
        const callbacks = this.#callbacks;

        this.#callbacks = {};

        for ( const id in callbacks ) {
            callbacks[ id ]( result( [ status, statusText ] ) );
        }
    }

    // XXX
    get #socket () {
        if ( isBrowser || !this.#ws ) {
            return null;
        }

        // XXX remove
        else if ( this.#ws._socket ) {
            return this.#ws._socket;
        }
        else {
            if ( !this.#responseSymbol ) {
                for ( const symbol of Object.getOwnPropertySymbols( this.#ws ) ) {
                    if ( symbol.description === "response" ) {
                        this.#responseSymbol = symbol;

                        break;
                    }
                }
            }

            return this.#ws[ this.#responseSymbol ].socket;
        }
    }
}
