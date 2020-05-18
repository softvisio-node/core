const WebSocket = require( "ws" );
const { "v4": uuidv4 } = require( "uuid" );
const res = require( "../result" );

module.exports = class {
    #url = null;
    #version = "v1";
    #token = null;
    #onConnect = null;
    #onDisconnect = null;
    #onEvent = null;
    #onRpc = null;

    #isConnected = false;
    #ws = null;
    #queue = [];
    #callbacks = {};

    constructor ( options ) {
        this.setUrl( options.url );
        this.setVersion( options.version );
        this.setToken( options.token );

        this.#onConnect = options.onConnect;
        this.#onDisconnect = options.onDisconnect;
        this.#onEvent = options.onEvent;
        this.#onRpc = options.onRpc;

        this._connect();
    }

    setUrl ( url ) {
        this.#url = url;

        if ( this.#ws ) this.#ws.terminate();
    }

    setVersion ( version ) {
        if ( version ) this.#version = version;
    }

    setToken ( token ) {
        if ( token !== this.#token ) {
            this.#token = token;

            const queue = this.#queue;

            this.#queue = [];

            if ( this.#ws ) this.#ws.terminate();

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

    // TODO
    async upload () {}

    emit ( topic, data ) {
        this.#queue.push( {
            "type": "event",
            "topic": topic,
            "data": data,
        } );

        this._sendQueue();
    }

    _connect () {
        if ( this.#ws ) return;

        this.#ws = new WebSocket( this.#url );

        this.#ws.on( "error", this._onError.bind( this ) );

        this.#ws.on( "open", this._onOpen.bind( this ) );

        this.#ws.on( "close", this._onClose.bind( this ) );

        this.#ws.on( "message", this._onMessage.bind( this ) );
    }

    _onError ( error ) {}

    _onOpen () {
        if ( this.#token != null ) {
            this.#ws.send( JSON.stringify( {
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

        this.#ws = null;

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
            if ( this.#onEvent ) this.#onEvent( msg.topic, msg.data );
        }
        else if ( msg.type === "rpc" ) {
            // rpc request
            if ( msg.method ) {
                // rpc calls are not supported
                if ( !this.#onRpc ) {
                    this.#ws.send( JSON.stringify( {
                        "type": "rpc",
                        "id": msg.id,
                        "result": {
                            "status": 400,
                            "reason": "RPC calls are not supported",
                        },
                    } ) );
                }
                else {
                    const ws = this.#ws,
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

    _sendQueue ( msg ) {
        if ( !this.#isConnected ) return;

        while ( this.#queue.length ) {
            const msg = this.#queue.shift();

            if ( msg.resolve ) {
                this.#callbacks[msg.id] = msg.resolve;

                delete msg.resolve;
            }

            this.#ws.send( JSON.stringify( msg ) );
        }
    }
};
