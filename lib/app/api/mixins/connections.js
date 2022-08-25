import env from "#lib/env";
import Context from "../context.js";
import EventsHub from "#lib/events/hub";
import Connection from "#lib/app/api/connection";

export default Super =>
    class Connections extends ( Super || Object ) {
        #incomingEvents = new EventsHub();
        #outgoingEvents = new EventsHub( { "maxListeners": Infinity } );

        // public
        getHttpServerConfig () {
            return {
                "ws": {
                    "maxBackpressure": 0,
                    "upgrade": this.#onWebSocketUpgrade.bind( this ),
                    "open": this.#onWebSocketOpen.bind( this ),
                    "maxPayloadLength": this.isApi ? this.app.config.apiMaxPayloadLength : this.app.config.rpcMaxPayloadLength,
                    "idleTimeout": this.isApi ? this.app.config.apiIdleTimeout : this.app.config.rpcIdleTimeout,
                    "compress": this.isApi ? this.app.config.apiCompress : this.app.config.rpcCompress,
                    "sendPingsAutomatically": this.isApi ? this.app.config.apiSendPingsAutomatically : this.app.config.rpcSendPingsAutomatically,
                    "connection": ( server, ws, options ) => new Connection( server, ws, options, this, this.#incomingEvents, this.#outgoingEvents, this.#publishRemoteIncomingEvent.bind( this ), this.#call.bind( this ) ),
                },
                "http": this.#onHttpRequest.bind( this ),
            };
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
        async #onWebSocketUpgrade ( req, context ) {
            const secWebSocketProtocol = req.headers.get( "sec-websocket-protocol" );

            const [protocol, token] = secWebSocketProtocol.split( /\s*,\s*/ );

            // authenticate
            const auth = await this.authenticate( token );

            if ( req.isAborted ) return;

            req.upgrade( context, {
                "data": {
                    auth,
                    "userAgent": req.headers["user-agent"],
                    "remoteAddress": req.realRemoteAddress(),
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

                // check content type
                {

                    // get content type
                    const contentType = req.headers.get( "content-type" );

                    if ( contentType ) {

                        // upload
                        if ( contentType.startsWith( "multipart/form-data" ) ) {
                            return this.#upload( req, methodId, token );
                        }

                        // invalid content type
                        else if ( !contentType.startsWith( "application/json" ) ) {
                            throw result( -32803 );
                        }
                    }
                }

                // post
                if ( req.method === "post" ) {
                    let body;

                    // read body if content length > 0
                    if ( req.headers.contentLength ) {
                        body = await req.buffer().catch( e => {

                            // http request aborted
                            throw result( -32807 );
                        } );
                    }

                    if ( !body ) {
                        args = [];
                    }

                    // decode body
                    else {
                        try {
                            args = JSON.parse( body );
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
                if ( typeof args === "object" && args.jsonrpc === "2.0" ) {
                    if ( req.method !== "post" ) throw result( [-32804, `Invalid HTTP method for JSON-RPC request`] );

                    methodId = args.method;
                    id = args.id;
                    args = args.params;

                    if ( !id ) voidCall = true;
                }

                // prepare args
                if ( !Array.isArray( args ) ) args = args === undefined ? [] : [args];

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

                // backend is down
                if ( !auth ) return res.end( { "status": 503 } );

                // token is invalid
                if ( !auth.isValid ) return res.end( { "status": 401 } );

                // update auth last activity timestamp
                if ( this.authCache ) this.authCache.updateAuthLastActivity( auth );

                // publish
                if ( methodId === "/publish" ) {
                    this.#publishRemoteIncomingEvent( auth, args );

                    res = result( 200 );
                }

                // rpc
                else {
                    const method = this.schema.methods[methodId];

                    // method not found
                    if ( !method ) throw result( -32809 );

                    // persistent connection is required
                    if ( method.persistentConnectionRequired ) throw result( -32810 );

                    // not upload method
                    if ( method.isUpload ) throw result( -32904 );

                    // void api call
                    if ( voidCall ) {
                        this.#call( auth, methodId, args, true, false );

                        res = result( 200 );
                    }
                    else {
                        res = await this.#call( auth, methodId, args, false, false );
                    }
                }
            }
            catch ( e ) {
                res = result.catch( e );
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
                "compress": this.isApi ? this.app.config.apiCompress : this.app.config.rpcCompress,
            } );
        }

        async #upload ( req, methodId, token ) {
            var res;

            try {

                // invalid HTTP method
                if ( req.method !== "post" ) throw result( -32804 );

                const method = this.schema.methods[methodId];

                // method not found
                if ( !method ) throw result( -32809 );

                // not upload method
                if ( !method.isUpload ) throw result( -32903 );

                const size = req.headers.contentLength;

                // check max. size
                if ( !size ) throw result( -32901 ); // size is required
                if ( size > method.uploadMaxSize ) throw result( -32902 );

                // authenticate
                const auth = await this.authenticate( token );

                // backend is down
                if ( !auth ) return res.end( { "status": 503 } );

                // token is invalid
                if ( !auth.isValid ) return res.end( { "status": 401 } );

                // update auth last activity timestamp
                if ( this.authCache ) this.authCache.updateAuthLastActivity( auth );

                // check roles
                if ( !auth.hasRoles( method.roles ) ) throw result( -32801 );

                var file, args;

                // read form data
                for await ( const { stream, headers } of req.formData ) {

                    // file
                    if ( headers.contentDisposition.name === "file" ) {

                        // not a file
                        if ( !headers.contentDisposition.filename ) throw result( -32906 );

                        // check content type
                        if ( method.uploadContentType ) {
                            if ( !method.uploadContentType.has( headers.contentType?.type ) ) throw result( -32906 );
                        }

                        file = await stream.tmpFile( { "name": headers.contentDisposition.filename, "type": headers.contentType?.type } );
                    }

                    // args
                    else if ( headers.contentDisposition.name === "params" ) {
                        const buffer = await stream.buffer();

                        if ( buffer ) {

                            // decode args
                            args = this.#decodeArguments( headers.contentType?.type, buffer );
                        }
                    }

                    // unexpected field
                    else {
                        throw result( -32907 );
                    }
                }

                if ( !file ) throw result( -32905 );

                // prepare args
                if ( args === undefined ) args = [file];
                else if ( !Array.isArray( args ) ) args = [file, args];
                else args.unshift( file );

                // call api method
                res = await this.#call( auth, methodId, args, false, false );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            if ( req.isAborted ) return;

            // read the rest of the request body in case if form-data was failed
            // this is required to return api error to the browser
            await req.stream.blackhole();

            // write response
            req.end( {
                "status": res.status,
                "headers": {
                    "content-type": "application/json",
                    ...( env.isDevelopment ? { "access-control-allow-origin": "*" } : {} ),
                },
                "body": JSON.stringify( res.toRpc() ),
                "compress": this.isApi ? this.app.config.apiCompress : this.app.config.rpcCompress,
            } );
        }

        async #call ( auth, methodId, args, isVoid, connection ) {

            // create public context
            const ctx = new Context( auth, {
                "isPrivate": false,
                "data": {
                    connection,
                },
            } );

            if ( isVoid ) {
                ctx.voidCall( methodId, ...args );
            }
            else {
                return ctx.call( methodId, ...args );
            }
        }

        #decodeArguments ( contentType, args ) {

            // invalid content type
            if ( contentType && !contentType.startsWith( "application/json" ) ) result( -32803 );

            try {
                args = JSON.parse( args );
            }
            catch ( e ) {
                throw result( -32807 );
            }

            return args;
        }

        #publishRemoteIncomingEvent ( auth, args ) {
            if ( !args[0] ) return;

            const name = args.shift();

            if ( Connection.localEvents.has( name ) ) return;

            this.#incomingEvents.publish( name, auth, ...args );
        }
    };
