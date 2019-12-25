const Request = require( "./api/request.js" );
const Result = require( "./util/result.js" );
const Upload = require( "./api/upload.js" );
const uuidv4 = require( "uuid/v4" );

module.exports = class softvisioApi {
    onEvent = null;

    onRpc = null;

    #url = null;

    #token = null;

    #version = "v1";

    #isConnected = null;

    // Websocket is connected
    #isAuthenticated = 0;

    // Connection is authenticated
    #ws = null;

    #connId = 1;

    // Outgoing tid counter
    #tidCallbacks = {};

    // Outgoing calls callbacks
    #sendQueue = []; // Outgoing messages queue

    constructor ( args ) {
        // Url
        const a = document.createElement( "a" );
        a.href = args.url || "/api";
        const url = new URL( a.href );
        if ( url.protocol !== "ws:" && url.protocol !== "wss:" ) {
            if ( url.protocol === "https:" ) {
                url.protocol = "wss:";
            }
            else {
                url.protocol = "ws:";
            }
        }

        if ( url.username ) {
            this.#token = url.username;

            url.username = "";
            url.password = "";
        }

        this.#url = url.toString();

        if ( args.token ) {
            this.#token = args.token;
        }

        if ( args.version ) {
            this.#version = args.version;
        }

        if ( args.onConnect ) {
            this.onConnect = args.onConnect;
        }

        if ( args.onDisconnect ) {
            this.onDisconnect = args.onDisconnect;
        }

        if ( args.onEvent ) {
            this.onEvent = args.onEvent;
        }

        if ( args.onRpc ) {
            this.onRpc = args.onRpc;
        }
    }

    auth ( token ) {
        // Do nothing if tokens are identical
        if ( token === this.#token ) {
            return;
        }

        // Store token
        this.#token = token;

        // Reset connection
        const res = new Result( [1012, "Service Restart"] );
        this._reset( res );

        // Authenticate, only if connected
        if ( this.#isConnected ) {
            const msg = {
                "type": "auth",
                "token": this.#token,
                "events": null,
            };

            this.#ws.send( JSON.stringify( msg ) );
        }
    }

    async call () {
        let method = arguments[0],
            args,
            cb;

        if ( arguments.length > 1 ) {
            if ( typeof arguments[arguments.length - 1] === "function" ) {
                cb = arguments[arguments.length - 1];

                if ( arguments.length > 2 ) {
                    args = Array.prototype.slice.call( arguments, 1, -1 );
                }
            }
            else {
                args = Array.prototype.slice.call( arguments, 1 );
            }
        }

        if ( String.prototype.substring.call( method, 0, 1 ) !== "/" ) {
            method = `/${this.#version}/${method}`;
        }

        const msg = {
            "type": "rpc",
            "tid": uuidv4(),
            method,
            args,
        };

        return new Promise( ( resolve ) => {
            if ( cb ) {
                this.#tidCallbacks[msg.tid] = ( res ) => {
                    cb( res );

                    resolve( res );
                };
            }
            else {
                this.#tidCallbacks[msg.tid] = resolve;
            }

            this._send( msg );
        } );
    }

    fireRemoteEvent ( key, data ) {
        const msg = {
            "type": "event",
            "event": {
                key,
                data,
            },
        };

        this._send( msg );
    }

    upload ( file, method, onProgress ) {
        return new Upload( this, file, method, onProgress );
    }

    _send ( msg ) {
        if ( msg ) {
            this.#sendQueue.push( msg );
        }

        if ( this.#isConnected ) {
            // Send messages if connection is connected and authenticated
            if ( this.#isAuthenticated ) {
                while ( this.#sendQueue.length ) {
                    msg = this.#sendQueue.shift();

                    this.#ws.send( JSON.stringify( msg ) );
                }
            }
        }
        else {
            this._connect();
        }
    }

    _connect () {
        if ( !this.#ws ) {
            const me = this;

            this.#ws = new WebSocket( this.#url, "softvisio" );

            this.#ws.binaryType = "blob";

            this.#ws.onopen = function ( e ) {
                me._onConnect( e );
            };

            this.#ws.onclose = function ( e ) {
                me._onDisconnect( e );
            };

            this.#ws.onmessage = function ( e ) {
                me._onMessage( e );
            };
        }
    }

    _onConnect () {
        this.#isConnected = 1;

        // Authentication is required
        if ( this.#token ) {
            const token = this.#token;

            // Force authentication
            this.#token = null;

            this.auth( token );
        }

        // Authentication is NOT required
        else {
            this.#isAuthenticated = 1;

            this._send();
        }
    }

    _onDisconnect ( e ) {
        this.#isConnected = 0;

        // Remove websocket handle
        this.#ws = null;

        const res = new Result( [e.code, e.reason || "Abnormal Closure"] );

        // Reset connection
        this._reset( res );
    }

    _onMessage ( e ) {
        const tx = JSON.parse( e.data );

        if ( tx.type === "auth" ) {
            // Authentication is done
            this.#isAuthenticated = 1;

            // Send pending messages
            this._send();
        }

        // Event
        else if ( tx.type === "event" ) {
            if ( this.onEvent ) this.onEvent( this, tx.event );
        }

        // RPC
        else if ( tx.type === "rpc" ) {
            // RPC call
            if ( tx.method ) {
                // RPC service is provided
                if ( this.onRpc ) {
                    const req = new Request( this, tx.tid, this.#connId ),
                        func = function () {
                            req.response( arguments );
                        };

                    this.onRpc( this, func, tx.method, tx.args );
                }

                // RPC service is not provided, response is required
                else if ( tx.tid ) {
                    const msg = {
                        "type": "rpc",
                        "tid": tx.tid,
                        "result": {
                            "status": 400,
                            "reason": "RPC calls are not supported",
                        },
                    };

                    this._send( msg );
                }
            }

            // RPC callback, tid is required
            else if ( tx.tid ) {
                if ( this.#tidCallbacks[tx.tid] ) {
                    const cb = this.#tidCallbacks[tx.tid];

                    delete this.#tidCallbacks[tx.tid];

                    cb( new Result( tx.result ) );
                }
            }
        }
    }

    _reset ( res ) {
        // Reset connection
        this.#isAuthenticated = 0;
        this.#connId++;
        this.#sendQueue = [];

        // Call pending callbacks
        const callbacks = this.#tidCallbacks;

        this.#tidCallbacks = {};

        for ( const tid in callbacks ) {
            callbacks[tid]( res );
        }
    }
};
