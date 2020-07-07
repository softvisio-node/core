const { mixin } = require( "../../mixins" );
const { result, parseResult } = require( "../../result" );
const { toMessagePack, fromMessagePack } = require( "../../util" );
const Upload = require( "./upload" );

// const WEBSOCKET_READYSTATE_CONNECTING = 0;
const WEBSOCKET_READYSTATE_OPEN = 1;

// const WEBSOCKET_READYSTATE_CLOSING = 2;
// const WEBSOCKET_READYSTATE_CLOSED = 3;

module.exports = mixin( Super =>
    class extends Super {
            #url;
            #version = "v1";
            #token;
            #persistent = true; // connect immediately, reconnec on close
            #onRpc;
            #eventNamePrefix = "event";

            #ws;
            #requestId = 0;
            #isConnected = false; // connection is ready to send messages
            #queue = [];
            #callbacks = {};

            constructor ( url, options = {} ) {
                super();

                this.setUrl( url );
                this.setVersion( options.version );
                if ( typeof options.token !== "undefined" ) this.setToken( options.token );

                if ( options.persistent != null ) this.#persistent = options.persistent;

                // EVENTS
                if ( options.onOpen ) this.on( "open", options.onOpen );
                if ( options.onClose ) this.on( "close", options.onClose );
                if ( options.onEvent ) this.on( "event", options.onEvent );
                if ( typeof options.eventNamePrefix !== "undefined" ) this.#eventNamePrefix = options.eventNamePrefix;

                // RPC
                this.#onRpc = options.onRpc;

                if ( this.#persistent ) this._connect();
            }

            setUrl ( url ) {
                url = super.setUrl( url );

                if ( this.#url !== url ) {
                    this.#url = url;

                    this._close();
                }
            }

            setVersion ( version ) {
                if ( version ) this.#version = version;
            }

            setToken ( token ) {
                if ( token !== this.#token ) {
                    this.#token = token;

                    this._close();
                }
            }

            // EVENTS
            emit ( name, ...args ) {
                this._sendQueue( {
                    "type": "event",
                    name,
                    args,
                } );

                return true;
            }

            // RPC
            async call ( method, ...args ) {

                // add api version to nethod
                if ( method.charAt( 0 ) !== "/" ) {
                    method = `/${this.#version}/${method}`;
                }

                return new Promise( resolve => {
                    this._sendQueue( {
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
                    this._sendQueue( {
                        "type": "rpc",
                        method,
                        args,
                    } );
                } );
            }

            // UPLOAD
            // method, file, args?, cb?
            async upload () {
                const method = arguments[0],
                    file = arguments[1];

                let args, onProgress;

                // parse arguments
                if ( arguments[2] ) {
                    if ( typeof arguments[2] === "function" ) {
                        onProgress = arguments[2];
                    }
                    else {
                        args = arguments[2];
                        onProgress = arguments[3];
                    }
                }

                const upload = new Upload();

                await upload.start( this, method, args, file, onProgress );

                return upload;
            }

            // PRIVATE
            _connect () {

                // do nothing if connection is already created
                if ( this.#ws ) return;

                this.#ws = this._createConnection( this.#url );
            }

            _onError ( error ) {}

            _onOpen () {
                if ( this.#token != null ) {
                    this._send( {
                        "type": "auth",
                        "token": this.#token,
                    } );
                }
                else {
                    this._onConnect();
                }
            }

            _onClose ( status, reason ) {
                this.#ws = null;

                this.#isConnected = false;

                // clear requsests queues
                this._clearPendingRequests();
                this._clearSentRequests( status, reason );

                super.emit( "close", result( [status, reason] ) );

                // reconnect, if connection is persistent
                if ( this.#persistent ) this._connect();
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
                        msg = fromMessagePack( msg );
                    }
                }
                catch ( e ) {
                    return;
                }

                // auth response
                if ( msg.type === "auth" ) {
                    this._onConnect();
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
                                this._send( {
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
                                    res = parseResult( await this.#onRpc( msg.method, msg.args ) );
                                }
                                catch ( e ) {
                                    res = result( 500 );
                                }

                                if ( ws.readyState === WEBSOCKET_READYSTATE_OPEN ) {
                                    ws.send( toMessagePack( {
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

                            callback( result( msg.result ) );
                        }
                    }
                }
            }

            _onConnect () {
                this.#isConnected = true;

                this._sendQueue();

                super.emit( "open" );
            }

            _sendQueue ( msg ) {
                if ( msg ) this.#queue.push( msg );

                if ( !this.#isConnected ) {
                    this._connect();
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

                        ws.send( toMessagePack( msg ) );
                    }
                }
            }

            _send ( msg ) {
                if ( this.#ws.readyState === WEBSOCKET_READYSTATE_OPEN ) {
                    this.#ws.send( toMessagePack( msg ) );
                }
                else {
                    this.#isConnected = false;
                }
            }

            _close () {
                this.#isConnected = false;

                if ( this.#ws ) this.#ws.close( 1000, "Normal Closure" );
            }

            _clearPendingRequests () {
                const queue = this.#queue;

                this.#queue = [];

                for ( const msg of queue ) {
                    if ( msg.resolve ) {
                        msg.resolve( result( [500, "Disconnected"] ) );
                    }
                }
            }

            _clearSentRequests ( status, reason ) {
                const callbacks = this.#callbacks;

                this.#callbacks = {};

                for ( const id in callbacks ) {
                    callbacks[id]( result( [status, reason] ) );
                }
            }
    } );
