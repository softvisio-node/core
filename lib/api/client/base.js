const { result, parseResult } = require( "../../result" );

// const WEBSOCKET_READYSTATE_CONNECTING = 0;
const WEBSOCKET_READYSTATE_OPEN = 1;

// const WEBSOCKET_READYSTATE_CLOSING = 2;
// const WEBSOCKET_READYSTATE_CLOSED = 3;

module.exports = class {
    #url;
    #version = "v1";
    #token;
    #persistent = true; // connect immediately, reconnec on close
    #onConnect;
    #onDisconnect;
    #onEvent;
    #onRpc;

    #ws;
    #requestId = 0;
    #isConnected = false; // connection is ready to send messages
    #queue = [];
    #callbacks = {};

    constructor ( options ) {
        this.setUrl( options.url );
        this.setVersion( options.version );
        this.setToken( options.token );

        if ( options.persistent != null ) this.#persistent = options.persistent;
        this.#onConnect = options.onConnect;
        this.#onDisconnect = options.onDisconnect;
        this.#onEvent = options.onEvent;
        this.#onRpc = options.onRpc;

        if ( this.#persistent ) this._connect();
    }

    setUrl ( url ) {
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

    async call ( method, ...args ) {

        // add api version to nethod
        if ( method.charAt( 0 ) !== "/" ) {
            method = `/${this.#version}/${method}`;
        }

        return new Promise( ( resolve ) => {
            this._sendQueue( {
                "type": "rpc",
                "id": ++this.#requestId,
                method,
                args,
                resolve,
            } );
        } );
    }

    emit ( name, ...args ) {
        this._sendQueue( {
            "type": "event",
            name,
            args,
        } );
    }

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

        if ( this.#onDisconnect ) this.#onDisconnect( result( [status, reason] ) );

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
            this._onConnect();
        }
        else if ( msg.type === "event" ) {
            if ( this.#onEvent ) this.#onEvent( msg.name, msg.args );
        }
        else if ( msg.type === "rpc" ) {

            // rpc request
            if ( msg.method ) {

                // rpc calls are not supported
                if ( !this.#onRpc ) {
                    this._send( {
                        "type": "rpc",
                        "id": msg.id,
                        "result": {
                            "status": 400,
                            "reason": "RPC calls are not supported",
                        },
                    } );
                }
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
                        ws.send( JSON.stringify( {
                            "type": "rpc",
                            "id": msg.id,
                            "result": res,
                        } ) );
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

        if ( this.#onConnect ) this.#onConnect();
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

                ws.send( JSON.stringify( msg ) );
            }
        }
    }

    _send ( msg ) {
        if ( this.#ws.readyState === WEBSOCKET_READYSTATE_OPEN ) {
            this.#ws.send( JSON.stringify( msg ) );
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
};
