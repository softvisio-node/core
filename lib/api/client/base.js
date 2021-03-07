require( "@softvisio/core" );
const result = require( "../../result" );
const { toMsgPack, fromMsgPack } = require( "../../msgpack" );
const Upload = require( "./upload" );

// const WEBSOCKET_READYSTATE_CONNECTING = 0;
const WEBSOCKET_READYSTATE_OPEN = 1;

// const WEBSOCKET_READYSTATE_CLOSING = 2;
// const WEBSOCKET_READYSTATE_CLOSED = 3;

module.exports = Super =>
    class extends ( Super || Object ) {
        #url;
        #version = "v1";
        #token;
        #onDemand; // connect only on demand, do not re-connect automatically
        #onRpc;
        #eventNamePrefix = "event";

        #ws;
        #requestId = 0;
        #isConnected = false; // connection is ready to send messages
        #queue = [];
        #callbacks = {};

        #pongInterval = 1000 * 60; // 60 seconds
        #pongClearInterval;

        constructor ( url, options = {} ) {
            super();

            this.url = url;
            this.version = options.version;
            if ( typeof options.token !== "undefined" ) this.token = options.token;

            this.#onDemand = options.onDemand;

            // EVENTS
            if ( options.onOpen ) this.on( "open", options.onOpen );
            if ( options.onClose ) this.on( "close", options.onClose );
            if ( options.onEvent ) this.on( "event", options.onEvent );
            if ( typeof options.eventNamePrefix !== "undefined" ) this.#eventNamePrefix = options.eventNamePrefix;

            // RPC
            this.#onRpc = options.onRpc;

            if ( !this.#onDemand ) this.#connect();
        }

        set url ( url ) {
            url = this._buildUrl( url );

            if ( url.username ) this.token = url.username;

            url.username = "";
            url.password = "";

            if ( this.#url !== url ) {
                this.#url = url;

                this.#close();
            }
        }

        set version ( version ) {
            if ( version ) this.#version = version;
        }

        set token ( token ) {
            if ( token !== this.#token ) {
                this.#token = token;

                this.#close();
            }
        }

        // EVENTS
        emit ( name, ...args ) {
            this.#sendQueue( {
                "type": "event",
                name,
                args,
            } );

            return true;
        }

        // PING
        async ping () {
            return new Promise( resolve => {
                const start = new Date();

                this.#sendQueue( {
                    "type": "ping",
                    "id": ++this.#requestId,
                    "start": new Date().getTime(),
                    "resolve": res => {
                        res.delay = new Date() - start;

                        resolve( res );
                    },
                } );
            } );
        }

        // PONG
        pong () {
            this.#sendQueue( {
                "type": "pong",
            } );
        }

        // RPC
        async call ( method, ...args ) {

            // add api version to nethod
            if ( method.charAt( 0 ) !== "/" ) {
                method = `/${this.#version}/${method}`;
            }

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
                method = `/${this.#version}/${method}`;
            }

            return new Promise( resolve => {
                this.#sendQueue( {
                    "type": "rpc",
                    method,
                    args,
                } );
            } );
        }

        // UPLOAD
        // method, file, options?, onProgress?
        async upload ( method, file, options, onProgress ) {
            if ( typeof options === "function" ) {
                onProgress = options;

                options = null;
            }

            return await new Upload( this, method, file, options, onProgress ).start();
        }

        // PRIVATE
        #connect () {

            // do nothing if connection is already created
            if ( this.#ws ) return;

            this.#ws = this._createConnection( this.#url );
        }

        _onError ( error ) {}

        _onOpen () {
            if ( !this.#onDemand ) this.#startPong();

            if ( this.#token != null ) {
                this.#send( {
                    "type": "auth",
                    "token": this.#token,
                } );
            }
            else {
                this.#onConnect();
            }
        }

        _onClose ( status, reason ) {
            this.#stopPong();

            this.#ws = null;

            this.#isConnected = false;

            // clear requsests queues
            this.#clearPendingRequests();
            this.#clearSentRequests( status, reason );

            super.emit( "close", result( [status, reason] ) );

            // reconnect, if connection is persistent
            if ( !this.#onDemand ) this.#connect();
        }

        async _onMessage ( msg ) {

            // decode message
            try {

                // text message
                if ( typeof msg === "string" ) {
                    msg = JSON.parse( msg );
                }

                // binary message
                else {
                    msg = fromMsgPack( msg );
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

            // auth response
            else if ( msg.type === "auth" ) {
                this.#onConnect();
            }

            // event
            else if ( msg.type === "event" ) {
                super.emit( "event", msg.name, msg.args );

                if ( this.#eventNamePrefix ) super.emit( this.#eventNamePrefix + "/" + msg.name, ...msg.args );
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
                                ws.send( toMsgPack( {
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

        #onConnect () {
            this.#isConnected = true;

            this.#sendQueue();

            super.emit( "open" );
        }

        #sendQueue ( msg ) {
            if ( msg ) this.#queue.push( msg );

            if ( !this.#isConnected ) {
                this.#connect();
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

                    ws.send( toMsgPack( msg ) );
                }
            }
        }

        #send ( msg ) {
            if ( this.#ws.readyState === WEBSOCKET_READYSTATE_OPEN ) {
                this.#ws.send( toMsgPack( msg ) );
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

        // PONG
        #startPong () {
            this.#stopPong();

            if ( !this.#pongInterval ) return;

            this.#pongClearInterval = setInterval( () => {
                this.#send( {
                    "type": "pong",
                } );
            }, this.#pongInterval );
        }

        #stopPong () {
            if ( this.#pongClearInterval ) clearInterval( this.#pongClearInterval );
        }
    };
