import Component from "#lib/app/api/component";
import env from "#lib/env";
import Events from "#lib/events";
import WebSocketConnection from "#lib/app/api/frontend/websocket-connection";
import Token from "#lib/app/token";
import Context from "#lib/app/api/frontend/context";
import File from "#lib/file";
import { resolve } from "#lib/utils";
import Cache from "./frontend/cache.js";
import Counter from "#lib/threads/counter";

export default class extends Component {
    #schema;
    #incomingEvents = new Events();
    #outgoingEvents = new Events( { "maxListeners": Infinity } );
    #activeApiCallsCounter = new Counter();
    #cache;
    #stats = {};

    // public
    on ( name, listener ) {
        this.#incomingEvents.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#incomingEvents.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#incomingEvents.off( name, listener );

        return this;
    }

    publish ( name, ...args ) {
        var users, publisherId;

        if ( typeof name === "object" ) {
            ( { name, users, "data": args, publisherId } = name );
        }

        const cache = {};

        if ( name.endsWith( "/" ) ) {
            users ??= args.shift();

            if ( !Array.isArray( users ) ) users = [users];

            for ( const user of users ) {
                this.#outgoingEvents.emit( name + user, args, cache, publisherId );
            }
        }
        else {
            this.#outgoingEvents.emit( name, args, cache, publisherId );
        }

        return this;
    }

    updateTokenLastActivity ( token ) {
        return this.#cache.updateTokenLastActivity( token );
    }

    startApiCall ( { activityCounter } ) {
        if ( activityCounter ) this.#activeApiCallsCounter.value++;

        return {
            activityCounter,
        };
    }

    async checkApiCallLimits ( callDescriptor, ctx, method, isPrivateCall ) {

        // do not check limits for
        if ( isPrivateCall ) return true;

        const maxParallelCallsPerClient = method.maxParallelCallsPerClient || this.api.config.frontend.maxParallelCallsPerClient;

        if ( !maxParallelCallsPerClient ) return true;

        const stats = this.#stats,
            statsId = ( ctx.token.id ? ctx.token.type + "/" + ctx.token.id : ctx.remoteAddress ) + "/" + method.id;

        // too many calls
        if ( stats[statsId] >= maxParallelCallsPerClient ) {
            return false;
        }

        stats[statsId] ??= 0;
        stats[statsId]++;

        callDescriptor.statsId = statsId;

        return true;
    }

    endApiCall ( callDescriptor ) {

        // decrement call limi counter
        if ( callDescriptor.statsId ) {
            this.#stats[callDescriptor.statsId]--;

            if ( !this.#stats[callDescriptor.statsId] ) delete this.#stats[callDescriptor.statsId];
        }

        // finish active call
        if ( callDescriptor.activityCounter ) this.#activeApiCallsCounter.value--;
    }

    // protected
    async _init ( getSchema ) {

        // link to the cluster
        if ( this.app.cluster ) {
            const prefix = this.api.isApi ? "to-api/" : "to-rpc/";

            this.#outgoingEvents.link( this.app.cluster, {
                "on": name => prefix + name,
                "forwarder": ( name, args ) => this.#outgoingEvents.emit( name, args, {} ),
            } );
        }

        if ( this.api.isApi ) {
            this.#cache = new Cache( this );
        }

        // configure http server
        this.#configureHttpServer();

        return result( 200 );
    }

    async _afterInit ( getSchema ) {
        var res;

        // load schema api objects
        res = await this.api.schema.loadApi( this.api );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async _start () {
        var res;

        if ( this.#cache ) {
            res = await this.#cache.start();
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async _shutDown () {
        await this.#activeApiCallsCounter.wait();

        await this.#cache?.shutDown();
    }

    // private
    #configureHttpServer () {
        const httpServer = this.api.httpServer;

        const location = "/api";

        const publishRemoteIncomingEvent = this.#publishRemoteIncomingEvent.bind( this ),
            websocketsConfig = {
                "maxBackpressure": 0,
                "onUpgrade": this.#onWebSocketUpgrade.bind( this ),
                "createConnection": this.#createWebSocketConnection.bind( this, publishRemoteIncomingEvent ),
                "maxPayloadLength": this.api.config.frontend.maxApiRequestLength,
                "idleTimeout": this.api.config.frontend.idleTimeout,
                "compress": this.api.config.frontend.compress,
                "sendPingsAutomatically": this.api.config.frontend.sendPingsAutomatically,
            },
            httpCallback = this.#onHttpRequest.bind( this ),
            oauthHtmlPath = resolve( "#resources/oauth.html", import.meta.url );

        // websocket
        if ( location === "" ) {
            httpServer.ws( "/", websocketsConfig );
        }
        else {
            httpServer.ws( location, websocketsConfig );
            httpServer.ws( `${location}/`, websocketsConfig );
        }

        // options
        if ( env.isDevelopment ) {
            httpServer.options( `${location}/*`, req => {
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
        httpServer.post( `${location}/*`, req => {

            // get method id
            const methodId = req.path.substring( location.length );

            httpCallback( req, methodId );
        } );

        // http get
        httpServer.get( `${location}/*`, req => {

            // get method id
            const methodId = req.path.substring( location.length );

            httpCallback( req, methodId );
        } );

        // oauth.html
        httpServer.get( `${location}/oauth.html`, req => {
            req.end( {
                "headers": {
                    "cache-control": "public, max-age=1",
                },
                "body": new File( { "path": oauthHtmlPath } ),
            } );
        } );
    }

    async #onWebSocketUpgrade ( req ) {

        // close new connections is frontend is shutting down
        if ( this.isShuttingDown ) {
            req.close( -32816 );

            return;
        }

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
                "locale": req.url.searchParams.get( "locale" ),
            },
            protocol,
        } );
    }

    #createWebSocketConnection ( publishRemoteIncomingEvent, server, ws, options ) {
        return new WebSocketConnection( {
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

            // authenticate
            const ctx = await this.#authenticate( token, {
                "signal": req.abortSignal,
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
            "body": JSON.stringify( res.toJsonRpc( id ) ),
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

        if ( WebSocketConnection.localEvents.has( name ) ) return;

        this.#incomingEvents.emit( name, ctx, ...args );
    }

    async #authenticate ( token, { signal, hostname, userAgent, remoteAddress } = {} ) {
        if ( this.api.isRpc ) {
            return new Context( this.api, {
                signal,
                hostname,
                userAgent,
                remoteAddress,
            } );
        }

        // api backend is down
        if ( !this.api.isConnected ) return;

        // no token to authenticate
        if ( !token ) {
            return new Context( this.api, {
                signal,
                hostname,
                userAgent,
                remoteAddress,
            } );
        }

        // parse token
        token = Token.new( this.app, token );

        var internalToken;

        if ( token.isUserToken ) {
            internalToken = this.api.tokens.cache.getCachedTokenById( token.id ) ?? ( await this.api.tokens.cache.getTokenById( token.id ) );
        }
        else if ( token.isUserSessionToken ) {
            internalToken = this.api.sessions.cache.getCachedSessionById( token.id ) ?? ( await this.api.sessions.cache.getSessionById( token.id ) );
        }

        // backend error
        if ( internalToken === false ) return;

        // token not found or invalid
        if ( !internalToken || !( await internalToken.verify( token ) ) ) {
            return new Context( this.api, {
                "isDeleted": true,
                signal,
                hostname,
                userAgent,
                remoteAddress,
            } );
        }

        const user = this.app.users.getCachedUserById( internalToken.userId ) ?? ( await this.app.users.getUserById( internalToken.userId ) );

        // backend error
        if ( user === false ) return;

        // user not found
        if ( !user ) {
            return new Context( this.api, {
                "isDeleted": true,
                signal,
                hostname,
                userAgent,
                remoteAddress,
            } );
        }

        return new Context( this.api, {
            "token": internalToken,
            user,
            signal,
            hostname,
            userAgent,
            remoteAddress,
        } );
    }
}
