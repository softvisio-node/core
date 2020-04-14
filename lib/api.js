const Request = require( "./api/request" );
const Result = require( "./util/result" );
const Upload = require( "./api/upload" );
const { "v4": uuidv4 } = require( "uuid" );

module.exports = class softvisioApi {
    constructor ( args ) {
        // public
        this.onEvent = null;
        this.onRpc = null;

        // private
        this._url = null;
        this._token = null;
        this._version = "v1";
        this._isConnected = null;
        this._isAuthenticated = 0; // Websocket is connected
        this._ws = null; // Connection is authenticated
        this._connId = 1;
        this._tidCallbacks = {}; // Outgoing tid counter
        this._sendQueue = []; // Outgoing messages queue

        // Url
        this.setUrl( args.url );

        if ( args.token ) {
            this._token = args.token;
        }

        if ( args.version ) {
            this._version = args.version;
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

    setUrl ( url ) {
        const a = document.createElement( "a" );

        a.href = url || "/api";

        url = new URL( a.href );

        if ( url.protocol !== "ws:" && url.protocol !== "wss:" ) {
            if ( url.protocol === "https:" ) {
                url.protocol = "wss:";
            }
            else {
                url.protocol = "ws:";
            }
        }

        if ( url.username ) {
            this._token = url.username;

            url.username = "";
            url.password = "";
        }

        this._url = url.toString();
    }

    auth ( token ) {
        // do nothing if tokens are identical
        if ( token === this._token ) {
            return;
        }

        // Store token
        this._token = token;

        // reset connection
        const res = new Result( [1012, "Service Restart"] );
        this._reset( res );

        // authenticate, only if connected
        if ( this._isConnected ) {
            this._auth();
        }
    }

    _auth () {
        const msg = {
            "type": "auth",
            "token": this._token,
            "events": null,
        };

        this._ws.send( JSON.stringify( msg ) );
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
            method = `/${this._version}/${method}`;
        }

        const msg = {
            "type": "rpc",
            "tid": uuidv4(),
            method,
            args,
        };

        return new Promise( ( resolve ) => {
            if ( cb ) {
                this._tidCallbacks[msg.tid] = ( res ) => {
                    cb( res );

                    resolve( res );
                };
            }
            else {
                this._tidCallbacks[msg.tid] = resolve;
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

        const upload = new Upload( file, onProgress );

        await upload._start( this, method, args );

        return upload;
    }

    _send ( msg ) {
        if ( msg ) {
            this._sendQueue.push( msg );
        }

        if ( this._isConnected ) {
            // Send messages if connection is connected and authenticated
            if ( this._isAuthenticated ) {
                while ( this._sendQueue.length ) {
                    msg = this._sendQueue.shift();

                    this._ws.send( JSON.stringify( msg ) );
                }
            }
        }
        else {
            this._connect();
        }
    }

    _connect () {
        if ( !this._ws ) {
            const me = this;

            this._ws = new WebSocket( this._url, "softvisio" );

            this._ws.binaryType = "blob";

            this._ws.onopen = function ( e ) {
                me._onConnect( e );
            };

            this._ws.onclose = function ( e ) {
                me._onDisconnect( e );
            };

            this._ws.onmessage = function ( e ) {
                me._onMessage( e );
            };
        }
    }

    _onConnect () {
        this._isConnected = 1;

        // authentication is required
        if ( this._token ) {
            this._auth();
        }

        // authentication is NOT required
        else {
            this._isAuthenticated = 1;

            this._send();
        }
    }

    _onDisconnect ( e ) {
        this._isConnected = 0;

        // Remove websocket handle
        this._ws = null;

        const res = new Result( [e.code, e.reason || "Abnormal Closure"] );

        // Reset connection
        this._reset( res );
    }

    _onMessage ( e ) {
        const tx = JSON.parse( e.data );

        if ( tx.type === "auth" ) {
            // authentication is done
            this._isAuthenticated = 1;

            // send pending messages
            this._send();
        }

        // event
        else if ( tx.type === "event" ) {
            if ( this.onEvent ) this.onEvent( this, tx.event );
        }

        // RPC
        else if ( tx.type === "rpc" ) {
            // RPC call
            if ( tx.method ) {
                // RPC service is provided
                if ( this.onRpc ) {
                    const req = new Request( this, tx.tid, this._connId ),
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
                if ( this._tidCallbacks[tx.tid] ) {
                    const cb = this._tidCallbacks[tx.tid];

                    delete this._tidCallbacks[tx.tid];

                    cb( new Result( tx.result ) );
                }
            }
        }
    }

    _reset ( res ) {
        // Reset connection
        this._isAuthenticated = 0;
        this._connId++;
        this._sendQueue = [];

        // Call pending callbacks
        const callbacks = this._tidCallbacks;

        this._tidCallbacks = {};

        for ( const tid in callbacks ) {
            callbacks[tid]( res );
        }
    }
};
