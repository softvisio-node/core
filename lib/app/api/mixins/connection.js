import msgpack from "#lib/msgpack";
import env from "#lib/env";
import Context from "../context.js";
import Events from "#lib/events";
import FormDataDecoder from "#lib/form-data/decoder";
import * as uuid from "#lib/uuid";

const LOCAL_EVENTS = new Set( ["connect", "disconnect", "client/connect", "client/disconnect"] );

class Client extends Events {
    #id = uuid.v4();
    #api;
    #ws;
    #invalidateListener;
    #eventsListener;
    #subscribedEvents = new Set();
    #status;
    #statusText;

    constructor ( api, ws ) {
        super();

        this.#api = api;
        this.#ws = ws;

        this.#invalidateListener = this.#invalidateListenerTemplate.bind( this );
        this.#eventsListener = this.#eventsListenerTemplate.bind( this );

        // set invalidate listener
        this.auth.once( "invalidate", this.#invalidateListener );
    }

    // properties
    get id () {
        return this.#id;
    }

    get api () {
        return this.#api;
    }

    get status () {
        return this.#status;
    }

    get statusText () {
        return this.#statusText;
    }

    get auth () {
        return this.#ws.auth;
    }

    get isConnected () {
        return !this.#ws.isClosed;
    }

    get isBinary () {
        return this.#ws.isBinary;
    }

    // public
    // XXX validate events names, ignore invalid
    subscribe ( names ) {
        if ( !this.isConnected ) return;

        if ( !names || !Array.isArray( names ) ) return;

        const auth = this.auth;

        for ( const name of names ) {

            // already subscribed
            if ( this.#subscribedEvents.has( name ) ) return;

            // event name is reserved
            if ( LOCAL_EVENTS.has( name ) ) continue;

            // XXX validate event name using api events list

            // subscribe to the user events
            if ( this.#api.isRpc ) {
                this.#subscribe( name );
            }
            else {
                this.#subscribe( `*/${name}` );

                if ( auth.isAuthenticated ) {
                    this.#subscribe( `${auth.userId}/${name}` );
                    this.#subscribe( `user/${name}` );

                    if ( auth.isRoot ) this.#subscribe( `root/${name}` );

                    for ( const permission in auth.permissions ) {
                        if ( auth.permissions[permission] ) this.#subscribe( `${permission}/${name}` );
                    }
                }
                else {
                    this.#subscribe( `guest/${name}` );
                }
            }
        }
    }

    unsubscribe ( names ) {
        if ( !names || !Array.isArray( names ) ) return;

        for ( const name of names ) this.#unsubscribe( name );
    }

    disconnect ( res ) {
        res ||= result( 1000 );

        if ( this.isConnected ) {
            this.#ws.end( res.status, res.statusText );

            return;
        }

        this.#status = res.status;
        this.#statusText = res.statusText;

        // remove invalidate listener
        this.#ws.auth.off( "invalidate", this.#invalidateListener );

        // unsubscribe from all events
        for ( const name of this.#subscribedEvents ) this.#unsubscribe( name );

        this.emit( "disconnect" );
    }

    // private
    #subscribe ( name ) {
        this.#subscribedEvents.add( name );

        this.#api.app.hub.on( this.#api.isRpc ? "rpc/out" : "api/out", name, this.#eventsListener );
    }

    #unsubscribe ( name ) {
        if ( !this.#subscribedEvents.has( name ) ) return;

        this.#subscribedEvents.delete( name );

        this.#api.app.hub.off( this.#api.isRpc ? "rpc/out" : "api/out", name, this.#eventsListener );
    }

    #invalidateListenerTemplate () {
        if ( !this.isConnected ) return;

        this.#ws.end( 4000, "Signed out" );
    }

    #eventsListenerTemplate ( msg, cache = {} ) {
        if ( this.#ws.isBinary ) {
            if ( !cache.binary ) cache.binary = msgpack.encode( msg );

            this.#ws.send( cache.binary, true );
        }
        else {
            if ( !cache.text ) cache.text = JSON.stringify( msg );

            this.#ws.send( cache.text, false );
        }
    }
}

export default Super =>
    class Connection extends ( Super || Object ) {

        // public
        getHttpServerConfig () {
            return {
                "ws": {

                    // NOTE
                    // 0 - Disable backpressure check. Internal unsent messages buffer can grow without limit.
                    // >0 - Some published or sent messages can be dropped. Need to create more complex code, that will check bufferedAmount before send and continue send after drained. For publishing it is impossible to control this, published messages will be dropped automatically in case of backpressure buit.
                    "maxBackpressure": 0,
                    "upgrade": this.#onWebSocketUpgrade.bind( this ),
                    "open": this.#onWebSocketOpen.bind( this ),
                    "close": this.#onWebSocketClose.bind( this ),
                    "message": this.#onWebSocketMessage.bind( this ),

                    // "drain": ws => {},
                    // "ping": ( ws, msg ) => console.log( "ping", msg ),
                    // "pong": ( ws, msg ) => console.log( "pong", new Date() ),
                },
                "http": this.#onHttpRequest.bind( this ),
            };
        }

        // private
        async #onWebSocketUpgrade ( res, req, context ) {
            res.onAborted( () => ( res.isAborted = true ) );

            const secWebSocketKey = req.getHeader( "sec-websocket-key" ),
                secWebSocketProtocol = req.getHeader( "sec-websocket-protocol" ),
                secWebSocketExtensions = req.getHeader( "sec-websocket-extensions" );

            const [protocol, token] = secWebSocketProtocol.split( /\s*,\s*/ );

            const auth = await this.authenticate( token );

            if ( res.isAborted ) return;

            res.upgrade( {
                auth,
            },
            secWebSocketKey,
            protocol,
            secWebSocketExtensions,
            context );
        }

        async #onWebSocketOpen ( ws, req ) {
            ws.client = new Client( this, ws );

            this.app.publish( "client/connect", ws.client );
        }

        #onWebSocketClose ( ws, status, statusText ) {
            ws.isClosed = true;
            ws.client.disconnect( result( [status, Buffer.from( statusText ).toString()] ) );

            this.app.publish( "client/disconnect", ws.client );
        }

        // XXX re-auth on sub / unsub, or remove re-auth, because we close connection???
        async #onWebSocketMessage ( ws, msg, isBinary ) {

            // try to decode message
            try {
                msg = isBinary ? msgpack.decode( msg ) : JSON.parse( Buffer.from( msg ) );
            }
            catch ( e ) {
                return;
            }

            ws.isBinary = isBinary;

            // request
            if ( msg.method ) {
                if ( !Array.isArray( msg.params ) ) msg.params = msg.params === undefined ? [] : [msg.params];

                // ping
                if ( msg.method === "/ping" ) {

                    // response with pong, if required
                    if ( msg.id ) this.#wsSend( ws, { "jsonrpc": "2.0", "id": msg.id, "method": "/pong" }, isBinary );
                }

                // pong
                else if ( msg.method === "/pong" ) {
                    return;
                }

                // healthcheck
                else if ( msg.method === "/healthcheck" ) {
                    const res = await this.healthCheck();

                    if ( msg.id ) this.#wsSend( ws, res.toRpc( msg.id ), isBinary );
                }

                // subscribe
                else if ( msg.method === "/subscribe" ) {
                    ws.client.subscribe( msg.params );
                }

                // unsubscribe
                else if ( msg.method === "/unsubscribe" ) {
                    ws.client.unsubscribe( msg.params );
                }

                // publish
                else if ( msg.method === "/publish" ) {
                    const name = msg.params.shift();

                    if ( !name ) return;

                    // re-authenticate
                    await ws.auth.authenticate();

                    this.#publishRemoteEvent( name, ws.auth, msg.params );
                }

                // rpc
                else {
                    const method = this.schema.methods[msg.method];

                    // upload method, invalid usage
                    if ( method?.isUpload ) {
                        if ( msg.id ) this.#wsSend( ws, result( -32900 ).toRpc( msg.id ), isBinary );
                    }

                    // binary protocol is required
                    else if ( method?.binaryProtocolRequired && !isBinary ) {
                        if ( msg.id ) this.#wsSend( ws, result( -32811 ).toRpc( msg.id ), isBinary );
                    }

                    // regular call
                    else if ( msg.id ) {
                        const res = await this.#call( ws.auth, msg.method, msg.params, false, ws.client );

                        this.#wsSend( ws, res.toRpc( msg.id ), isBinary );
                    }

                    // void call
                    else {
                        this.#call( ws.auth, msg.method, msg.params, true, ws.client );
                    }
                }
            }
        }

        #wsSend ( ws, msg, isBinary ) {
            if ( ws.isClosed ) return;

            if ( isBinary ) {
                ws.send( msgpack.encode( msg ), true );
            }
            else {
                ws.send( JSON.stringify( msg ), false );
            }
        }

        async #onHttpRequest ( req, methodId ) {
            var res, token, voidCall, isBinary, id, params;

            try {
                voidCall = req.getHeader( "api-call-void" ) === "true";

                // get token
                {
                    token = req.getHeader( "authorization" );

                    // prepare token
                    if ( token ) token = token.trim().replace( /^bearer\s+/i, "" );
                }

                // check content type
                {

                    // get content type
                    const contentType = req.getHeader( "content-type" );

                    // json
                    if ( !contentType || contentType.startsWith( "application/json" ) ) {
                        isBinary = false;
                    }

                    // msgpack
                    else if ( contentType.startsWith( "application/msgpack" ) ) {
                        isBinary = true;
                    }

                    // upload
                    else if ( contentType.startsWith( "multipart/form-data" ) ) {
                        return this.#upload( req, methodId, token );
                    }

                    // invalid content type
                    else {
                        throw result( -32803 );
                    }
                }

                // post
                if ( req.method === "post" ) {
                    let body;

                    // read body if content-length > 0
                    if ( req.getHeader( "content-length" ) > 0 ) {
                        body = await req.buffer();

                        // body stream read error
                        if ( !body ) throw result( -32807 );
                    }

                    if ( !body ) {
                        params = [];
                    }

                    // decode body
                    else {
                        try {
                            params = isBinary ? msgpack.decode( body ) : JSON.parse( body );
                        }
                        catch ( e ) {
                            throw result( -32807 );
                        }
                    }
                }

                // invalid HTTP method
                else if ( req.method !== "get" ) {
                    throw result( -32804 );
                }

                // jsonrpc call
                if ( typeof params === "object" && params.jsonrpc === "2.0" ) {
                    if ( req.method !== "post" ) throw result( [-32804, `Invalid HTTP method for JSON-RPC request`] );

                    methodId = params.method;
                    id = params.id;
                    params = params.params;

                    if ( !id ) voidCall = true;
                }

                // prepare params
                if ( !Array.isArray( params ) ) params = params === undefined ? [] : [params];

                // ping
                if ( methodId === "/ping" ) {
                    throw result( 200 );
                }

                // pong
                else if ( methodId === "/pong" ) {
                    throw result( 200 );
                }

                // healthcheck
                else if ( methodId === "/healthcheck" ) {
                    throw await this.healthCheck();
                }

                // authenticate
                const auth = await this.authenticate( token );

                // event
                if ( methodId === "/publish" ) {
                    if ( !params[0] ) throw result( 200 );

                    // prepare event params
                    if ( !Array.isArray( params[1] ) ) params[1] = params[1] === undefined ? [] : [params[1]];

                    this.#publishRemoteEvent( params[0], auth, params[1] );

                    res = result( 200 );
                }

                // rpc
                else {
                    const method = this.schema.methods[methodId];

                    // method not found
                    if ( !method ) throw result( -32809 );

                    // persistent connection is required
                    if ( method.persistentConnectionRequired ) throw result( -32810 );

                    // binary protocol is required
                    if ( method.binaryProtocolRequired && !isBinary ) throw result( -32811 );

                    // not upload method
                    if ( method.isUpload ) throw result( -32904 );

                    // void api call
                    if ( voidCall ) {
                        this.#call( auth, methodId, params, true, false );

                        res = result( 200 );
                    }
                    else {
                        res = await this.#call( auth, methodId, params, false, false );
                    }
                }
            }
            catch ( e ) {
                res = result.catch( e );
            }

            if ( req.isAborted ) return;

            // write response
            req.cork( () => {
                req.writeHead( res.status );

                if ( env.isDevelopment ) req.writeHeader( "Access-Control-Allow-Origin", "*" );

                if ( isBinary ) {
                    req.writeHeader( "Content-Type", "application/msgpack" );
                    req.end( msgpack.encode( res.toRpc( id ) ) );
                }
                else {
                    req.writeHeader( "Content-Type", "application/json" );
                    req.end( JSON.stringify( res.toRpc( id ) ) );
                }
            } );
        }

        async #upload ( req, methodId, token ) {
            var res, isBinary;

            try {

                // invalid HTTP method
                if ( req.method !== "post" ) throw result( -32804 );

                const method = this.schema.methods[methodId];

                // method not found
                if ( !method ) throw result( -32809 );

                // not upload method
                if ( !method.isUpload ) throw result( -32903 );

                const size = req.headers.get( "content-length" );

                // check max. size
                if ( !size ) throw result( -32901 ); // size is required
                if ( size > method.uploadMaxSize ) throw result( -32902 );

                // authenticate
                const auth = await this.authenticate( token );

                // check permissions
                if ( !auth.hasPermissions( method.permissions ) ) throw result( -32801 );

                // start upload
                var file, params;

                const formDataDecoder = new FormDataDecoder( req.getHeader( "content-type" ) );

                formDataDecoder.on( "field", async ( name, stream, headers ) => {

                    // file
                    if ( name === "file" ) {

                        // not a file
                        if ( !headers.contentDisposition?.filename ) return stream.cancel( result( -32906 ) );

                        // check content type
                        if ( method.uploadContentType ) {
                            if ( !method.uploadContentType.has( headers.get( "content-type" ) ) ) return stream.cancel( result( -32906 ) );
                        }

                        file = await stream.tmpFile( { "name": headers.contentDisposition.filename, "type": headers.get( "content-type" ) } );

                        stream.finish();
                    }

                    // params
                    else if ( name === "params" ) {
                        const buffer = await stream.buffer();

                        if ( buffer ) {

                            // decode params
                            try {
                                [isBinary, params] = this.#decodeParams( buffer, headers["content-type"] );

                                stream.finish();
                            }
                            catch ( e ) {
                                stream.cancel( e );
                            }
                        }
                    }

                    // unexpected field
                    else {
                        stream.cancel( result( -32907 ) );
                    }
                } );

                // wait for decoder complete
                res = await new Promise( resolve => {
                    formDataDecoder.once( "finish", resolve );

                    formDataDecoder.decode( req.stream );
                } );

                if ( !res.ok ) throw res;

                if ( !file ) throw result( -32905 );

                if ( params === undefined ) params = [file];
                else if ( !Array.isArray( params ) ) params = [file, params];
                else params.unshift( file );

                res = await this.#call( auth, methodId, params, false, false );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            if ( req.isAborted ) return;

            // read the rest of the request body in case if it was terminated
            await req.stream.blackhole();

            // write response
            req.cork( () => {
                req.writeHead( res.status );

                if ( env.isDevelopment ) req.writeHeader( "Access-Control-Allow-Origin", "*" );

                if ( isBinary ) {
                    req.writeHeader( "Content-Type", "application/msgpack" );
                    req.end( msgpack.encode( res.toRpc() ) );
                }
                else {
                    req.writeHeader( "Content-Type", "application/json" );
                    req.end( JSON.stringify( res.toRpc() ) );
                }
            } );
        }

        async #call ( auth, methodId, args, isVoid, client ) {

            // create public context
            const ctx = new Context( auth, {
                "isPrivate": false,
                client,
            } );

            if ( isVoid ) {
                ctx.callVoid( methodId, ...args );
            }
            else {
                return ctx.call( methodId, ...args );
            }
        }

        #decodeParams ( params, type ) {
            var isBinary;

            if ( !type || type.startsWith( "application/json" ) ) isBinary = false;
            else if ( type.startsWith( "application/msgpack" ) ) isBinary = true;
            else throw result( -32803 );

            try {
                params = isBinary ? msgpack.decode( params ) : JSON.parse( params );
            }
            catch ( e ) {
                throw result( -32807 );
            }

            return [isBinary, params];
        }

        #publishRemoteEvent ( name, auth, args ) {
            if ( LOCAL_EVENTS.has( name ) ) return;

            this.app.hub.publish( this.isRpc ? "rpc/in" : "api/in", name, [auth, args] );
        }
    };
