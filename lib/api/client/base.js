const { mixin } = require( "../../mixins" );
const { "v4": uuidv4 } = require( "uuid" );
const res = require( "../../result" );

module.exports = mixin( ( Super ) =>
    class extends Super {
            #version = "v1";
            #token = null;
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

                this.#onConnect = options.onConnect;
                this.#onDisconnect = options.onDisconnect;
                this.#onEvent = options.onEvent;
                this.#onRpc = options.onRpc;

                this._connect();
            }

            setVersion ( version ) {
                if ( version ) this.#version = version;
            }

            setToken ( token ) {
                if ( token !== this.#token ) {
                    this.#token = token;

                    const queue = this.#queue;

                    this.#queue = [];

                    this._close( 1000, "Normal Closure" );

                    // clear msg queue
                    for ( const msg of queue ) {
                        if ( msg.resolve ) {
                            msg.resolve( res( [500, "Disconnected"] ) );
                        }
                    }
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
                this.#isConnected = false;

                // call pending callbacks
                const callbacks = this.#callbacks;

                this.#callbacks = {};

                for ( const id in callbacks ) {
                    callbacks[id]( res( [status, reason] ) );
                }

                if ( this.#onDisconnect ) this.#onDisconnect( res( [status, reason] ) );

                this._connect();
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
                            const ws = this._getWs(),
                                res = await this.#onRpc( msg.method, msg.args );

                            ws.send( JSON.stringify( {
                                "type": "rpc",
                                "id": msg.id,
                                "result": res,
                            } ) );
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
                if ( !this.#isConnected ) return;

                while ( this.#queue.length ) {
                    const msg = this.#queue.shift();

                    if ( msg.resolve ) {
                        this.#callbacks[msg.id] = msg.resolve;

                        delete msg.resolve;
                    }

                    this._send( JSON.stringify( msg ) );
                }
            }
    } );
