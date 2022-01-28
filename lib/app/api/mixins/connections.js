import msgpack from "#lib/msgpack";
import env from "#lib/env";
import Context from "../context.js";
import Events from "#lib/events";
import EventsHub from "#lib/events/hub";
import FormDataDecoder from "#lib/form-data/decoder";
import * as uuid from "#lib/uuid";

const LOCAL_EVENTS = new Set( [

    //
    "connect",
    "disconnect",
    "backend/connect",
    "backend/disconnect",
] );

class Connection extends Events {
    #id = uuid.v4();
    #api;
    #ws;
    #out;
    #isConnected = true;
    #subscribedEvents = new Map();
    #status;
    #statusText;
    #disconnectCalled;

    constructor ( api, ws, out ) {
        super();

        this.#api = api;
        this.#ws = ws;
        this.#out = out;
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
        return this.#isConnected;
    }

    get isBinary () {
        return this.#ws.isBinary;
    }

    // public
    disconnect ( res ) {
        if ( this.#disconnectCalled || !this.#isConnected ) return;

        this.#disconnectCalled = true;

        res ||= result( 1000 );

        this.#ws.end( res.status, res.statusText );
    }

    onSubscribe ( names ) {
        if ( !this.#isConnected ) return;

        if ( !names || !Array.isArray( names ) ) return;

        const auth = this.auth;

        for ( const name of names ) {

            // already subscribed
            if ( this.#subscribedEvents.has( name ) ) return;

            // event name is reserved
            if ( LOCAL_EVENTS.has( name ) ) continue;

            if ( !this.#api.schema.allowAllevents && !this.#api.schema.emits.has( name ) ) {
                if ( env.isDevelopment ) console.log( `ERROR: ignore unregistered event "${name}"` );

                continue;
            }

            // subscribe to the user events
            if ( this.#api.isRpc ) {
                this.#subscribe( name, name );
            }
            else {
                this.#subscribe( name, `${name}/*` );

                if ( auth.isAuthenticated ) {
                    this.#subscribe( name, `${name}/user` );
                    if ( auth.isRoot ) this.#subscribe( name, `${name}/root` );

                    this.#subscribe( name, `${name}/${auth.userId}` );

                    for ( const [permission, enabled] of Object.entries( auth.permissions ) ) {
                        if ( enabled ) this.#subscribe( name, `${name}/${permission}` );
                    }
                }
                else {
                    this.#subscribe( name, `${name}/guest` );
                }
            }
        }
    }

    onUnsubscribe ( names ) {
        if ( !names || !Array.isArray( names ) ) return;

        for ( const name of names ) this.#unsubscribe( name );
    }

    onClose ( status, statusText ) {
        this.#isConnected = false;
        this.#status = status;
        this.#statusText = statusText;

        // unsubscribe from all events
        for ( const name of this.#subscribedEvents.keys() ) this.#unsubscribe( name );

        this.emit( "disconnect", this );
    }

    // private
    #subscribe ( name, listenName ) {
        const listener = this.#eventsListener.bind( this, name );

        this.#subscribedEvents.set( name, listener );

        this.#out.on( listenName, listener );
    }

    #unsubscribe ( name ) {
        const listener = this.#subscribedEvents.get( name );

        if ( !listener ) return;

        this.#subscribedEvents.delete( name );

        this.#out.off( name, listener );
    }

    #eventsListener ( name, args, cache, publisherId ) {
        if ( !this.#isConnected ) return;

        if ( publisherId === this.#id ) return;

        cache.msg ??= {
            "jsonrpc": "2.0",
            "method": "/publish",
            "params": [name, ...args],
        };

        if ( this.isBinary ) {
            if ( !cache.binary ) cache.binary = msgpack.encode( cache.msg );

            this.#ws.send( cache.binary, true );
        }
        else {
            if ( !cache.text ) cache.text = JSON.stringify( cache.msg );

            this.#ws.send( cache.text, false );
        }
    }
}

export default Super =>
    class Connections extends ( Super || Object ) {
        #in = new EventsHub();
        #out = new EventsHub();

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

        on ( name, listener ) {
            this.#in.on( name, listener );
        }

        once ( name, listener ) {
            this.#in.once( name, listener );
        }

        off ( name, listener ) {
            this.#in.off( name, listener );
        }

        publish ( name, ...args ) {
            if ( name.endsWith( "/" ) ) {
                const targets = Array.isArray( args[0] ) ? args.shift() : [args.shift()],
                    cache = {};

                for ( const target of targets ) {
                    const targetName = name + target;

                    this.#out.publish( targetName, args, cache );
                }
            }
            else {
                this.#out.publish( name, args, {} );
            }
        }

        forwardEvent ( name, args, cache, publisherId ) {
            this.#out.publish( name, args, cache, publisherId );
        }

        forwardSubscriptions ( target, { on, off, listener } = {} ) {
            listener ||= ( name, ...args ) => this.#out.publish( name, args, {} );

            this.#out.forwardSubscriptions( target, { on, off, listener } );
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

            // unable to authenticate, dbh is not connected
            if ( !auth ) return res.writeStatus( "503" ).end();

            res.upgrade( {
                auth,
                "badCredentials": token && !auth.isAuthenticated,
            },
            secWebSocketKey,
            protocol,
            secWebSocketExtensions,
            context );
        }

        // XXX remove timeout
        async #onWebSocketOpen ( ws, req ) {

            // bad credentials
            // XXX https://github.com/uNetworking/uWebSockets.js/issues/690
            if ( ws.badCredentials ) {
                return setTimeout( () => {
                    if ( !ws.isClosed ) ws.end( 4000 );
                }, 100 );
            }

            ws.connection = new Connection( this, ws, this.#out );

            if ( this.isApi ) this.authCache.registerConnection( ws.connection );

            // update auth last activity timestamp
            if ( this.authCache ) this.authCache.updateAuthLastActivity( ws.auth );

            this.#in.publish( "connect", ws.connection );
        }

        #onWebSocketClose ( ws, status, statusText ) {
            ws.isClosed = true;

            // ws was terminater before connection created
            if ( !ws.connection ) return;

            ws.connection.onClose( status, Buffer.from( statusText ).toString() );

            this.#in.publish( "disconnect", ws.connection );
        }

        // XXX
        async #onWebSocketMessage ( ws, msg, isBinary ) {

            // XXX remove
            if ( !ws.connection ) return;

            // update auth last activity timestamp
            if ( this.authCache ) this.authCache.updateAuthLastActivity( ws.auth );

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
                    ws.connection.onSubscribe( ...msg.params );
                }

                // unsubscribe
                else if ( msg.method === "/unsubscribe" ) {
                    ws.connection.onUnsubscribe( ...msg.params );
                }

                // publish
                else if ( msg.method === "/publish" ) {
                    this.#publishRemoteIncomingEvent( ws.auth, msg.params );
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
                        const res = await this.#call( ws.auth, msg.method, msg.params, false, ws.connection );

                        this.#wsSend( ws, res.toRpc( msg.id ), isBinary );
                    }

                    // void call
                    else {
                        this.#call( ws.auth, msg.method, msg.params, true, ws.connection );
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

                // unable to authenticate, dbh is not connected
                if ( !auth ) return res.writeStatus( "503" ).end();

                // update auth last activity timestamp
                if ( this.authCache ) this.authCache.updateAuthLastActivity( auth );

                // publish
                if ( methodId === "/publish" ) {
                    this.#publishRemoteIncomingEvent( auth, params );

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

                // unable to authenticate, dbh is not connected
                if ( !auth ) return res.writeStatus( "503" ).end();

                // update auth last activity timestamp
                if ( this.authCache ) this.authCache.updateAuthLastActivity( auth );

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

        async #call ( auth, methodId, args, isVoid, connection ) {

            // create public context
            const ctx = new Context( auth, {
                "isPrivate": false,
                connection,
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

        #publishRemoteIncomingEvent ( auth, args ) {
            if ( !args[0] ) return;

            const name = args.shift();

            if ( LOCAL_EVENTS.has( name ) ) return;

            this.#in.publish( name, auth, ...args );
        }
    };
