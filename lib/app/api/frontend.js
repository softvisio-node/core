import env from "#lib/env";
import EventsHub from "#lib/events/hub";
import Connection from "#lib/app/api/frontend/connection";
import Context from "#lib/app/api/frontend/context";
import File from "#lib/file";

export default class {
    #api;
    #schema;
    #incomingEvents = new EventsHub();
    #outgoingEvents = new EventsHub( { "maxListeners": Infinity } );

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
        res = this.api.isApi ? this.app.components.getApiSchema() : this.app.components.getRpcSchema();
        if ( !res.ok ) return res;
        this.#schema = res.data;

        // load schema api
        res = await this.#schema.loadApi( this.api );
        if ( !res.ok ) return res;

        // configure http server
        if ( this.httpServer ) this.#configureHttpServer();

        return result( 200 );
    }

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
        const publishRemoteIncomingEvent = this.#publishRemoteIncomingEvent.bind( this ),
            call = this.#call.bind( this );

        this.httpServer.api( "/api", {
            "websocketsConfig": {
                "maxBackpressure": 0,
                "upgrade": this.#onWebSocketUpgrade.bind( this ),
                "open": this.#onWebSocketOpen.bind( this ),
                "maxPayloadLength": this.api.config.frontend.maxApiRequestLength,
                "idleTimeout": this.api.config.frontend.idleTimeout,
                "compress": this.api.config.frontend.compress,
                "sendPingsAutomatically": this.api.config.frontend.sendPingsAutomatically,
                "connection": ( server, ws, options ) =>
                    new Connection( {
                        server,
                        ws,
                        options,
                        "api": this,
                        "incomingEvents": this.#incomingEvents,
                        "outgoingEvents": this.#outgoingEvents,
                        "publishRemoteIncomingEvent": publishRemoteIncomingEvent,
                        call,
                    } ),
            },
            "httpCallback": this.#onHttpRequest.bind( this ),
        } );
    }

    async #onWebSocketUpgrade ( req, context ) {
        const secWebSocketProtocol = req.headers.get( "sec-websocket-protocol" );

        const [protocol, token] = secWebSocketProtocol.split( /\s*,\s*/ );

        // authenticate
        const auth = await this.api.authenticate( token );

        if ( req.isAborted ) return;

        req.upgrade( context, {
            "data": {
                auth,
                "hostname": req.headers.get( "host" ),
                "userAgent": req.headers.get( "user-agent" ),
                "remoteAddress": req.realRemoteAddress,
            },
            protocol,
        } );
    }

    async #onWebSocketOpen ( connection ) {
        const auth = connection.data.auth;

        // backend is down
        if ( !auth ) return connection.end( 4503 );

        // token is invalid
        if ( !auth.isValid ) return connection.end( 4401 );

        if ( this.authCache ) {

            // register authenticated connection
            if ( auth.isAuthenticated ) this.authCache.registerConnection( connection );

            // update auth last activity timestamp
            this.authCache.updateAuthLastActivity( auth );
        }

        this.#incomingEvents.publish( "connect", connection );
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
                throw await this.healthCheck();
            }

            // authenticate
            const auth = await this.api.authenticate( token );

            // backend is down
            if ( !auth ) throw result( 503 );

            // token is invalid
            if ( !auth.isValid ) throw result( 401 );

            // update auth last activity timestamp
            if ( this.authCache ) this.authCache.updateAuthLastActivity( auth );

            // publish
            if ( methodId === "/publish" ) {
                this.#publishRemoteIncomingEvent( auth, args );

                res = result( 200 );
            }

            // rpc
            else {

                // void api call
                if ( voidCall ) {
                    this.#call( auth, methodId, args, {
                        "isVoid": true,
                        "connection": false,
                        "hostname": req.headers.get( "host" ),
                        "userAgent": req.headers.get( "user-agent" ),
                        "remoteAddress": req.realRemoteAddress,
                    } );

                    res = result( 200 );
                }
                else {
                    res = await this.#call( auth, methodId, args, {
                        "isVoid": false,
                        "connection": false,
                        "hostname": req.headers.get( "host" ),
                        "userAgent": req.headers.get( "user-agent" ),
                        "remoteAddress": req.realRemoteAddress,
                    } );
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

    async #call ( auth, methodId, args, { isVoid, connection, hostname, userAgent, remoteAddress } ) {

        // create public context
        const ctx = new Context( {
            auth,
            "isPrivate": false,
            connection,
            hostname,
            userAgent,
            remoteAddress,
        } );

        if ( isVoid ) {
            ctx.voidCall( methodId, ...args );
        }
        else {
            return ctx.call( methodId, ...args );
        }
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

    #publishRemoteIncomingEvent ( auth, args ) {
        if ( !args[0] ) return;

        const name = args.shift();

        if ( Connection.localEvents.has( name ) ) return;

        this.#incomingEvents.publish( name, auth, ...args );
    }
}
