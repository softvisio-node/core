import MSGPACK from "#lib/msgpack";
import File from "#lib/file";
import env from "#lib/env";
import Context from "../context.js";
import Events from "#lib/events";

export default Super =>
    class Connection extends ( Super || Object ) {
        #connections = new Set();
        #events = new Events( { "maxListeners": Infinity } );

        // public
        getHttpServerConfig () {
            return {
                "ws": {

                    // NOTE
                    // 0 - Disable backpressure check. Internal unsent messages buffer can grow without limit.
                    // >0 - Some published or sent messages can be dropped. Need to create more complex code, that will check bufferedAmount before send and continue send after drained. For publishing it is impossible to control this, published messages will be dropped automatically in case of backpressure buit.
                    "maxBackpressure": 0,
                    "open": this.#onWebsocketOpen.bind( this ),
                    "close": this.#onWebsocketClose.bind( this ),
                    "message": this.#onWebsocketMessage.bind( this ),
                    "upgrade": this.#onWebsocketUpgrade.bind( this ),

                    // "drain": ws => {},
                    // "ping": ( ws, msg ) => console.log( "ping", msg ),
                    // "pong": ( ws, msg ) => console.log( "pong", new Date() ),
                },
                "http": this.#onHttpRequest.bind( this ),
            };
        }

        publish ( users, name, ...args ) {
            var msg,
                cache = {};

            if ( !Array.isArray( users ) ) users = [users];

            for ( const user of users ) {
                if ( !this.#events.listenerCount( user ) ) continue;

                msg ||= {
                    "jsonrpc": "2.0",
                    "method": "/event",
                    "params": [name, ...args],
                };

                this.#events.emit( user, msg, cache );
            }
        }

        // protected
        _onRemoteEvent ( name, auth, args ) {
            this.emit( "event", name, auth, args );
            this.emit( "event/" + name, auth, ...args );
        }

        // private
        async #onWebsocketUpgrade ( res, req, context ) {
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

        async #onWebsocketOpen ( ws, req ) {

            // register connection
            this.#connections.add( ws );

            // set invalidate listener
            ws.invalidateListener = this.#wsInvalidateListener.bind( this, ws );
            ws.auth.once( "invalidate", ws.invalidateListener );

            // set publish listeners
            ws.listener = this.#wsPublishListener.bind( this, ws );
            ws.events = this.#getEventNames( ws.auth );
            for ( const name of ws.events ) this.#events.on( name, ws.listener );
        }

        #onWebsocketClose ( ws, status, statusText ) {

            // statusText = Buffer.from( statusText );

            ws.isClosed = true;

            // remove connection
            this.#connections.delete( ws );

            // remove invalidate listener
            if ( ws.invalidateListener ) {
                ws.auth.off( "invalidate", ws.invalidateListener );
                ws.invalidateListener = null;
            }

            // remove publish listeners
            for ( const name of ws.events ) this.#events.off( name, ws.listener );
            ws.listener = null;
            ws.events = null;
        }

        async #onWebsocketMessage ( ws, msg, isBinary ) {

            // try to decode message
            try {
                msg = isBinary ? MSGPACK.decode( msg ) : JSON.parse( Buffer.from( msg ) );
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

                    if ( msg.id ) this.#wsSend( ws, res.toRPC( msg.id ), isBinary );
                }

                // event
                else if ( msg.method === "/event" ) {
                    const name = msg.params.shift();

                    if ( !name ) return;

                    // re-authenticate
                    await ws.auth.authenticate();

                    this._onRemoteEvent( name, ws.auth, msg.params );
                }

                // rpc
                else {
                    const method = this.schema.methods[msg.method];

                    // upload, invalid usage
                    if ( method?.isUpload ) {
                        if ( msg.id ) this.#wsSend( ws, result( -32900 ).toRPC( msg.id ), isBinary );
                    }

                    // regular call
                    else if ( msg.id ) {
                        const res = await this.#call( ws.auth, msg.method, msg.params, false, true );

                        this.#wsSend( ws, res.toRPC( msg.id ), isBinary );
                    }

                    // void call
                    else {
                        this.#call( ws.auth, msg.method, msg.params, true, true );
                    }
                }
            }
        }

        #wsSend ( ws, msg, isBinary ) {
            if ( ws.isClosed ) return;

            if ( isBinary ) {
                ws.send( MSGPACK.encode( msg ), true );
            }
            else {
                ws.send( JSON.stringify( msg ), false );
            }
        }

        #wsPublishListener ( ws, msg, cache ) {
            if ( ws.isClosed ) return;

            if ( ws.isBinary ) {
                if ( !cache.binary ) cache.binary = MSGPACK.encode( msg );

                ws.send( cache.binary, true );
            }
            else {
                if ( !cache.text ) cache.text = JSON.stringify( msg );

                ws.send( cache.text, false );
            }
        }

        #wsInvalidateListener ( ws ) {
            if ( ws.isClosed ) return;

            ws.end( 1100, "Signed out" );
        }

        #getEventNames ( auth ) {
            const names = ["*"];

            if ( auth.isAuthenticated ) {
                names.push( auth.userId, "user" );

                if ( auth.isRoot ) names.push( "root" );

                for ( const permission in auth.permissions ) {
                    if ( auth.permissions[permission] ) names.push( permission );
                }
            }
            else {
                names.push( "guest" );
            }

            return names;
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
                    const body = await req.buffer();

                    if ( !body.byteLength ) params = [];

                    // decode body
                    else {
                        try {
                            params = isBinary ? MSGPACK.decode( body ) : JSON.parse( body );
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
                if ( methodId === "/event" ) {
                    if ( !params[0] ) throw result( 200 );

                    // prepare event params
                    if ( !Array.isArray( params[1] ) ) params[1] = params[1] === undefined ? [] : [params[1]];

                    this._onRemoteEvent( params[0], auth, params[1] );

                    res = result( 200 );
                }

                // rpc
                else {
                    const method = this.schema.methods[methodId];

                    // method not found
                    if ( !method ) throw result( -32809 );

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
                    req.end( MSGPACK.encode( res.toRPC( id ) ) );
                }
                else {
                    req.writeHeader( "Content-Type", "application/json" );
                    req.end( JSON.stringify( res.toRPC( id ) ) );
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

                const size = req.headers["content-length"];

                // check max. size
                if ( !size ) throw result( -32901 ); // size is required
                if ( size > method.meta.uploadMaxSize ) throw result( -32902 );

                // authenticate
                const auth = await this.authenticate( token );

                // check permissions
                if ( !auth.hasPermissions( method.permissions ) ) throw result( -32801 );

                // start upload
                var file, params;

                const formDataDecoder = req.formData();

                formDataDecoder.on( "field", async ( name, stream, headers ) => {

                    // file
                    if ( name === "file" ) {

                        // not a file
                        if ( !headers.filename ) return stream.cancel( result( -32906 ) );

                        // check content type
                        if ( method.meta.uploadContentType ) {
                            const types = new Set( method.meta.uploadContentType );

                            if ( !types.has( headers["content-type"] ) ) return stream.cancel( result( -32906 ) );
                        }

                        const tmpFile = await stream.writeToTmpFile();

                        if ( tmpFile ) {
                            file = new File( {
                                "name": headers.filename,
                                "path": tmpFile,
                                "type": headers["content-type"],
                            } );

                            stream.finish();
                        }
                    }

                    // params
                    else if ( name === "params" ) {
                        const buffer = await stream.writeToBuffer();

                        // unable to write to the buffer
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
                    formDataDecoder.once( "complete", resolve );

                    formDataDecoder.decode();
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

            // write response
            req.cork( () => {
                req.writeHead( res.status );

                if ( env.isDevelopment ) req.writeHeader( "Access-Control-Allow-Origin", "*" );

                if ( isBinary ) {
                    req.writeHeader( "Content-Type", "application/msgpack" );
                    req.end( MSGPACK.encode( res.toRPC() ) );
                }
                else {
                    req.writeHeader( "Content-Type", "application/json" );
                    req.end( JSON.stringify( res.toRPC() ) );
                }
            } );
        }

        async #call ( auth, methodId, args, isVoid, isWebsocket ) {

            // create public context
            const ctx = new Context( auth, {
                "isPrivate": false,
                isWebsocket,
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
                params = isBinary ? MSGPACK.decode( params ) : JSON.parse( params );
            }
            catch ( e ) {
                throw result( -32807 );
            }

            return [isBinary, params];
        }
    };
