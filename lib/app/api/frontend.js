import env from "#lib/env";
import EventsHub from "#lib/events/hub";
import Connection from "#lib/app/api/frontend/connection";
import Token from "#lib/app/api/token";
import Context from "#lib/app/api/frontend/context";
import File from "#lib/file";
import { resolve } from "#lib/utils";

export default class {
    #api;
    #schema;
    #incomingEvents = new EventsHub();
    #outgoingEvents = new EventsHub( { "maxListeners": Infinity } );
    #requestsStats = {};

    constructor ( api ) {
        this.#api = api;
    }

    // properties
    get app () {
        return this.#api.app;
    }

    get api () {
        return this.#api;
    }

    get isShuttingDown () {
        return this.#api.isShuttingDown;
    }

    get requestsStats () {
        return this.#requestsStats;
    }

    get httpServer () {
        return this.#api.httpServer;
    }

    get schema () {
        return this.#schema;
    }

    // public
    async init () {
        var res;

        // create schema
        res = this.api.isApi ? this.app.components.getSchema( "api" ) : this.app.components.getSchema( "rpc" );
        if ( !res.ok ) return res;
        this.#schema = res.data;

        return result( 200 );
    }

    async postInit () {
        var res;

        // load schema api objects
        res = await this.#schema.loadApi( this.api );
        if ( !res.ok ) return res;

        // configure http server
        if ( this.httpServer ) this.#configureHttpServer();

        return result( 200 );
    }

    async run () {
        return result( 200 );
    }

    // XXX
    async stop () {}

    on ( name, listener ) {
        this.#incomingEvents.on( name, listener );
    }

    once ( name, listener ) {
        this.#incomingEvents.once( name, listener );
    }

    off ( name, listener ) {
        this.#incomingEvents.off( name, listener );
    }

    publish ( name, ...args ) {
        if ( name.endsWith( "/" ) ) {
            const targets = Array.isArray( args[0] ) ? args.shift() : [args.shift()],
                cache = {};

            for ( const target of targets ) {
                const targetName = name + target;

                this.#outgoingEvents.publish( targetName, args, cache );
            }
        }
        else {
            this.#outgoingEvents.publish( name, args, {} );
        }
    }

    forwardEvent ( name, args, cache, publisherId ) {
        this.#outgoingEvents.publish( name, args, cache, publisherId );
    }

    forwardSubscriptions ( target, { on, off, listener } = {} ) {
        listener ||= ( name, ...args ) => this.#outgoingEvents.publish( name, args, {} );

        this.#outgoingEvents.forwardSubscriptions( target, { on, off, listener } );
    }

    // private
    #configureHttpServer () {
        const location = "/api";

        const publishRemoteIncomingEvent = this.#publishRemoteIncomingEvent.bind( this ),
            websocketsConfig = {
                "maxBackpressure": 0,
                "onUpgrade": this.#onWebSocketUpgrade.bind( this ),
                "createConnection": this.#createWebsocketConnection.bind( this, publishRemoteIncomingEvent ),
                "maxPayloadLength": this.api.config.frontend.maxApiRequestLength,
                "idleTimeout": this.api.config.frontend.idleTimeout,
                "compress": this.api.config.frontend.compress,
                "sendPingsAutomatically": this.api.config.frontend.sendPingsAutomatically,
            },
            httpCallback = this.#onHttpRequest.bind( this ),
            oauthHtmlPath = resolve( "#resources/oauth.html", import.meta.url );

        // websocket
        if ( location === "" ) {
            this.httpServer.ws( "/", websocketsConfig );
        }
        else {
            this.httpServer.ws( location, websocketsConfig );
            this.httpServer.ws( `${location}/`, websocketsConfig );
        }

        // options
        if ( env.isDevelopment ) {
            this.httpServer.options( `${location}/*`, req => {
                req.end( {
                    "status": 204,
                    "headers": {
                        "access-control-allow-origin": "*",
                        "access-control-allow-methods": "*",
                        "access-control-allow-headers": "*, Authorization",
                        "access-control-expose-headers": "*, Authorization",
                        "access-control-max-age": 86400, // cache for 24 hours
                    },
                } );
            } );
        }

        // http post
        this.httpServer.post( `${location}/*`, req => {

            // get method id
            const methodId = req.path.substring( location.length );

            httpCallback( req, methodId );
        } );

        // http get
        this.httpServer.get( `${location}/*`, req => {

            // get method id
            const methodId = req.path.substring( location.length );

            httpCallback( req, methodId );
        } );

        // oauth.html
        this.httpServer.get( `${location}/oauth.html`, req => {
            req.end( {
                "headers": {
                    "cache-control": "public, max-age=1",
                },
                "body": new File( { "path": oauthHtmlPath } ),
            } );
        } );
    }

    async #onWebSocketUpgrade ( req ) {
        const secWebSocketProtocol = req.headers.get( "sec-websocket-protocol" );

        const [protocol, token] = secWebSocketProtocol.split( /\s*,\s*/ );

        const ctx = await this.#authenticate( token, {
            "hostname": req.headers.get( "host" ),
            "userAgent": req.headers.get( "user-agent" ),
            "remoteAddress": req.realRemoteAddress,
        } );

        if ( req.isAborted ) return;

        // backend is down
        if ( !ctx ) return req.end( -32814 );

        req.upgrade( {
            "data": {
                ctx,
            },
            protocol,
        } );
    }

    #createWebsocketConnection ( publishRemoteIncomingEvent, server, ws, options ) {
        return new Connection( {
            server,
            ws,
            options,
            "incomingEvents": this.#incomingEvents,
            "outgoingEvents": this.#outgoingEvents,
            "publishRemoteIncomingEvent": publishRemoteIncomingEvent,
        } );
    }

    async #onHttpRequest ( req, methodId ) {
        var res, token, voidCall, id, args;

        try {
            voidCall = req.headers.get( "x-api-void-call" ) === "true";

            // get token
            {
                token = req.headers.get( "authorization" );

                // prepare token
                if ( token ) token = token.trim().replace( /^bearer\s+/i, "" );
            }

            // get
            if ( req.method === "get" ) {
                args = [];
            }

            // post
            else if ( req.method === "post" ) {

                // multipart/form-data
                if ( req.headers.contentType?.type === "multipart/form-data" ) {

                    // read form data
                    const fields = await req.formData.getFields( {
                        "maxBufferLength": this.api.config.frontend.maxApiRequestLength,
                        "maxFileSize": this.api.config.frontend.maxUploadFileSize,
                    } );

                    args = {};

                    // prepare args
                    for ( const name in fields ) {
                        const field = fields[name];

                        if ( !Array.isArray( field ) ) {

                            // file field
                            if ( field.value instanceof File ) {
                                args[name] = field.value;
                            }

                            // json field
                            else {
                                args[name] = this.#decodeArguments( field.value, field.headers.contentType );
                            }
                        }
                        else {
                            args[name] = [];

                            for ( const field of fields[name] ) {

                                // file field
                                if ( field.value instanceof File ) {
                                    args[name].push( field.value );
                                }

                                // json field
                                else {
                                    args[name].push( this.#decodeArguments( field.value, field.headers.contentType ) );
                                }
                            }
                        }
                    }
                }

                // application/json
                else {
                    const body = await req.buffer( { "maxLength": this.api.config.frontend.maxApiRequestLength } ).catch( e => {

                        // http request aborted
                        throw result( -32807 );
                    } );

                    args = this.#decodeArguments( body, req.headers.contentType );

                    // jsonrpc call
                    if ( typeof args === "object" && args.jsonrpc === "2.0" ) {
                        methodId = args.method;
                        id = args.id;
                        args = args.params;

                        if ( !id ) voidCall = true;
                    }
                }

                // prepare args
                if ( !Array.isArray( args ) ) args = args === undefined ? [] : [args];
            }

            // invalid HTTP method
            else {
                throw result( -32804 );
            }

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
                throw await this.api.healthCheck.getHealthCheckStatus();
            }

            // authenticate
            const ctx = await this.#authenticate( token, {
                "hostname": req.headers.get( "host" ),
                "userAgent": req.headers.get( "user-agent" ),
                "remoteAddress": req.realRemoteAddress,
            } );

            // backend is down
            if ( !ctx ) throw result( -32814 );

            // update last activity timestamp
            ctx.updateLastActivity();

            // publish
            if ( methodId === "/publish" ) {
                this.#publishRemoteIncomingEvent( ctx, args );

                res = result( 200 );
            }

            // rpc
            else {

                // void api call
                if ( voidCall ) {
                    ctx.voidCall( methodId, ...args );

                    res = result( 200 );
                }
                else {
                    res = await ctx.call( methodId, ...args );
                }
            }
        }
        catch ( e ) {
            res = result.catch( e, { "keepError": true, "silent": true } );
        }

        if ( req.isAborted ) return;

        // write response
        req.end( {
            "status": res.status,
            "headers": {
                "content-type": "application/json",
                ...( env.isDevelopment ? { "access-control-allow-origin": "*" } : {} ),
            },
            "body": JSON.stringify( res.toRpc( id ) ),
            "compress": this.api.config.frontend.compress,
        } );
    }

    #decodeArguments ( buffer, contentType ) {

        // invalid content type
        if ( contentType && contentType.type !== "application/json" ) throw result( -32803 );

        if ( !buffer.length ) return [];

        try {
            return JSON.parse( buffer );
        }
        catch ( e ) {

            // unable to decode RPC message body
            throw result( -32807 );
        }
    }

    #publishRemoteIncomingEvent ( ctx, args ) {

        // context is deleted or disabled
        if ( ctx.isDeleted || !ctx.isEnabled ) return;

        if ( !args[0] ) return;

        const name = args.shift();

        if ( Connection.localEvents.has( name ) ) return;

        this.#incomingEvents.publish( name, ctx, ...args );
    }

    async #authenticate ( token, { hostname, userAgent, remoteAddress } = {} ) {
        if ( this.#api.isRpc ) {
            return new Context( this.#api, {
                hostname,
                userAgent,
                remoteAddress,
            } );
        }

        // api backend is down
        if ( !this.#api.isConnected ) return;

        // no token to authenticate
        if ( !token ) {
            return new Context( this.#api, {
                hostname,
                userAgent,
                remoteAddress,
            } );
        }

        // parse token
        token = Token.new( this.#api, token );

        var internalToken;

        if ( token.isUserToken ) {
            internalToken = this.#api.cache.getCachedUserTokenById( token.id ) ?? ( await this.#api.cache.getUserTokenById( token.id ) );
        }
        else if ( token.isUserSessionToken ) {
            internalToken = this.#api.cache.getCachedUserSessionById( token.id ) ?? ( await this.#api.cache.getUserSessionById( token.id ) );
        }

        // backend error
        if ( internalToken === false ) return;

        // token not found or invalid
        if ( !internalToken || !( await internalToken.verify( token ) ) ) {
            return new Context( this.#api, {
                "isDeleted": true,
                hostname,
                userAgent,
                remoteAddress,
            } );
        }

        const user = this.#api.cache.getCachedUserById( internalToken.userId ) ?? ( await this.#api.cache.getUserById( internalToken.userId ) );

        // backend error
        if ( user === false ) return;

        // user not found
        if ( !user ) {
            return new Context( this.#api, {
                "isDeleted": true,
                hostname,
                userAgent,
                remoteAddress,
            } );
        }

        return new Context( this.#api, {
            "token": internalToken,
            user,
            hostname,
            userAgent,
            remoteAddress,
        } );
    }
}
