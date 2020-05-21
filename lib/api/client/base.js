const { mixin } = require( "../../mixins" );
const { "v4": uuidv4 } = require( "uuid" );
const { res, parseRes } = require( "../../result" );

// const WEBSOCKET_READYSTATE_CONNECTING = 0;
const WEBSOCKET_READYSTATE_OPEN = 1;
// const WEBSOCKET_READYSTATE_CLOSING = 2;
// const WEBSOCKET_READYSTATE_CLOSED = 3;

module.exports = mixin( ( Super ) =>
    class extends Super {
            #version = "v1";
            #token = null;
            #persistent = false; // connect immediately, reconnec on close
            #onConnect = null;
            #onDisconnect = null;
            #onEvent = null;
            #onRpc = null;

            #isConnected = false;
            #queue = [];
            #callbacks = {};

            constructor ( options ) {
                super( options );

                this.setUrl( options.url );
                this.setVersion( options.version );
                this.setToken( options.token );

                this.#persistent = options.persistent;
                this.#onConnect = options.onConnect;
                this.#onDisconnect = options.onDisconnect;
                this.#onEvent = options.onEvent;
                this.#onRpc = options.onRpc;

                if ( this.#persistent ) this._connect();
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

            async call ( method, ...args ) {
                // add api version to nethod
                if ( method.charAt( 0 ) !== "/" ) {
                    method = `/${this.#version}/${method}`;
                }

                return new Promise( ( resolve ) => {
                    this.#queue.push( {
                        "type": "rpc",
                        "id": uuidv4(),
                        method,
                        args,
                        resolve,
                    } );

                    this._sendQueue();
                } );
            }

            emit ( name, ...args ) {
                this.#queue.push( {
                    "type": "event",
                    name,
                    args,
                } );

                this._sendQueue();
            }

            _connect () {
                // do nothing if connection is already created
                if ( this._getWs() ) return;

                super._connect();
            }

            _onError ( error ) {}

            _onOpen () {
                if ( this.#token != null ) {
                    this._send( JSON.stringify( {
                        "type": "auth",
                        "token": this.#token,
                    } ) );
                }
                else {
                    this._onAuth();
                }
            }

            _onClose ( status, reason ) {
                super._onClose();

                this.#isConnected = false;

                // clear requsests queues
                this._clearPendingRequests();
                this._clearSentRequests( status, reason );

                if ( this.#onDisconnect ) this.#onDisconnect( res( [status, reason] ) );

                // reconnect, if connection is persistent
                if ( this.#persistent ) this._connect();
            }

            async _onMessage ( msg ) {
                try {
                    msg = JSON.parse( msg );
                }
                catch ( e ) {
                    return;
                }

                if ( msg.type === "auth" ) {
                    this._onAuth();
                }
                else if ( msg.type === "event" ) {
                    if ( this.#onEvent ) this.#onEvent( msg.name, msg.args );
                }
                else if ( msg.type === "rpc" ) {
                    // rpc request
                    if ( msg.method ) {
                        // rpc calls are not supported
                        if ( !this.#onRpc ) {
                            this._send( JSON.stringify( {
                                "type": "rpc",
                                "id": msg.id,
                                "result": {
                                    "status": 400,
                                    "reason": "RPC calls are not supported",
                                },
                            } ) );
                        }
                        else {
                            const ws = this._getWs();

                            let result;

                            try {
                                result = parseRes( await this.#onRpc( msg.method, msg.args ) );
                            }
                            catch ( e ) {
                                result = res( 500 );
                            }

                            if ( ws.readyState === WEBSOCKET_READYSTATE_OPEN ) {
                                ws.send( JSON.stringify( {
                                    "type": "rpc",
                                    "id": msg.id,
                                    result,
                                } ) );
                            }
                        }
                    }

                    // rpc response
                    else {
                        const callback = this.#callbacks[msg.id];

                        if ( callback ) {
                            delete this.#callbacks[msg.id];

                            callback( res( msg.result ) );
                        }
                    }
                }
            }

            _onAuth () {
                this.#isConnected = true;

                this._sendQueue();

                if ( this.#onConnect ) this.#onConnect();
            }

            _sendQueue () {
                if ( !this.#isConnected ) {
                    this._connect();
                }
                else {
                    while ( this.#queue.length ) {
                        const msg = this.#queue.shift();

                        if ( msg.resolve ) {
                            this.#callbacks[msg.id] = msg.resolve;

                            delete msg.resolve;
                        }

                        this._send( JSON.stringify( msg ) );
                    }
                }
            }

            _close () {
                this.#isConnected = false;

                var ws = this._getWs();

                if ( ws ) ws.close( 1000, "Normal Closure" );
            }

            _send ( data ) {
                var ws = this._getWs();

                if ( ws.readyState === WEBSOCKET_READYSTATE_OPEN ) {
                    ws.send( data );
                }
            }

            _clearPendingRequests () {
                const queue = this.#queue;

                this.#queue = [];

                for ( const msg of queue ) {
                    if ( msg.resolve ) {
                        msg.resolve( res( [500, "Disconnected"] ) );
                    }
                }
            }

            _clearSentRequests ( status, reason ) {
                const callbacks = this.#callbacks;

                this.#callbacks = {};

                for ( const id in callbacks ) {
                    callbacks[id]( res( [status, reason] ) );
                }
            }
    } );
