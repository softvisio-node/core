import MSGPACK from "#lib/msgpack";
import fs from "#lib/fs";
import FormData from "#lib/form-data";
import File from "#lib/file";
import env from "#lib/env";
import Context from "../context.js";

import CONST from "#lib/const";

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

        // protected
        _onWebsocketOpen ( ws ) {
            const auth = ws.auth;

            ws.subscribe( ":users:*" ); // all

            if ( auth.isAuthenticated ) {
                ws.subscribe( ":users:user" ); // authenticated
                if ( auth.isRoot ) ws.subscribe( ":users:root" );
                ws.subscribe( ":users:" + auth.userId );

                for ( const permission in auth.permissions ) {
                    if ( auth.permissions[permission] ) ws.subscribe( ":users:" + permission );
                }
            }
            else {
                ws.subscribe( ":users:guest" ); // not authenticated
            }
        }

        async _onWebsocketEvent ( ws, msg ) {
            if ( !Array.isArray( msg.params ) || !msg.params.length ) return;

            // re-authenticate
            await ws.auth.authenticate();

            const name = msg.params.shift();

            this.app.publish( "user/" + name, ws.auth, ...msg.params );
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
            this._onWebsocketOpen( ws );

            ws.auth.on( "invalidate", () => {
                if ( !ws.isClosed ) ws.end( 1100, "Signed out" );
            } );
        }

        #onWebsocketClose ( ws, status, statusText ) {
            ws.isClosed = true;

            // statusText = Buffer.from( statusText );
        }

        async #onWebsocketMessage ( ws, msg, isBinary ) {

            // try to decode message
            try {
                msg = isBinary ? MSGPACK.decode( msg ) : JSON.parse( Buffer.from( msg ) );
            }
            catch ( e ) {
                return;
            }

            // request
            if ( msg.method ) {

                // ping
                if ( msg.method === "/ping" ) {

                    // response with pong, if required
                    if ( msg.id ) this.#wsSend( ws, isBinary, { "id": msg.id, "method": "/pong" } );
                }

                // pong
                else if ( msg.method === "/pong" ) {

                    // do nothing
                }

                // event
                else if ( msg.method === "/event" ) {
                    this._onWebsocketEvent( ws, msg );
                }

                // rpc
                else {
                    const id = msg.id,
                        method = this.schema.methods[msg.method];

                    // upload, invalid usage
                    if ( method?.upload ) {
                        if ( id ) {
                            this.#wsSend( ws, isBinary, {
                                id,
                                "result": result( [-32600, `Uploads using websockets is not supported`] ),
                            } );
                        }
                    }

                    // void call
                    else if ( !id ) {
                        this.#call( ws.auth, msg.method, msg.params, true );
                    }

                    // regular call
                    else {
                        const res = await this.#call( ws.auth, msg.method, msg.params );

                        this.#wsSend( ws, isBinary, {
                            id,
                            "result": res,
                        } );
                    }
                }
            }
        }

        #wsSend ( ws, isBinary, msg ) {
            if ( ws.isClosed ) return;

            if ( isBinary ) ws.send( MSGPACK.encode( msg ), true );
            else ws.send( JSON.stringify( msg ), false );
        }

        // XXX
        async #onHttpRequest ( req, methodId ) {

            // ping
            if ( methodId === "/ping" ) {
                req.end();

                return;
            }

            // pong
            else if ( methodId === "/pong" ) {
                req.end();

                return;
            }

            // healthcheck
            else if ( methodId === "/healthcheck" ) {
                const healthcheck = await this.healthCheck();

                // write response
                if ( !req.isAborted ) {
                    req.cork( () => {
                        req.writeHead( healthcheck.ok ? 200 : 503 )
                            .writeHeader( "Content-Type", "application/json" )
                            .end( JSON.stringify( healthcheck ) );
                    } );
                }

                return;
            }

            var params, res, isBinary, isUpload;

            const method = this.schema.methods[methodId];

            try {

                // get content type
                const contentType = req.getHeader( "content-type" );

                // upload
                if ( method?.upload ) {
                    if ( !contentType.startsWith( "multipart/form-data" ) ) throw result( -32803 ); // invalid content type

                    const size = req.headers["content-length"];

                    // check max. size
                    if ( !size ) throw result( -32806 ); // Length Required
                    if ( size > ( method.uploadMaxSize || CONST.DEFAULT_UPLOAD_MAX_SIZE ) ) throw result( -32805 ); // Payload Too Large

                    isUpload = true;
                }

                // content type: json
                else if ( !contentType || contentType.startsWith( "application/json" ) ) {
                    isBinary = false;
                }

                // content type: msgpack
                else if ( contentType.startsWith( "application/msgpack" ) ) {
                    isBinary = true;
                }

                // invalid content type
                else {
                    throw result( -32803 );
                }

                // get token
                var token = req.getHeader( "authorization" );

                // prepare token
                if ( token ) token = token.trim().replace( /^bearer\s+/i, "" );

                const voidCall = req.getHeader( "api-call-void" ) === "true";

                // upload
                if ( isUpload ) {

                    // HTTP method not allowed
                    if ( req.method !== "post" ) throw result( -32804 );

                    // get and cache headers before await call
                    req.headers;
                }

                // get
                else if ( req.method === "get" ) {
                    try {
                        params = {};

                        for ( const [name, value] of req.searchParams ) params[name] = value;
                    }
                    catch ( e ) {

                        // invalid params
                        throw result( -32602 );
                    }
                }

                // post
                else if ( req.method === "post" ) {

                    // read request body
                    const body = await req.buffer();

                    if ( !body.byteLength ) {
                        params = [];
                    }

                    // decode msgpack
                    else if ( isBinary ) {
                        try {
                            params = MSGPACK.decode( body );
                        }
                        catch ( e ) {
                            throw result( -32700 );
                        }
                    }

                    // decode json
                    else {
                        try {
                            params = JSON.parse( body );
                        }
                        catch ( e ) {
                            throw result( -32700 );
                        }
                    }
                }

                // invalid method
                else {
                    throw result( -32804 ); // HTTP Method Not Allowed
                }

                // void api call
                if ( voidCall ) req.end();

                // authenticate
                const auth = await this.authenticate( token );

                // call api method
                if ( isUpload ) {

                    // check permissions
                    if ( !auth.hasPermissions( method.permissions ) ) throw result( -32803 );

                    res = await this.#upload( auth, methodId, req );

                    isBinary = req.isBinary;
                }
                else {
                    res = await this.#call( auth, methodId, params );
                }
            }
            catch ( e ) {
                res = result.catch( e );
            }

            // write response
            if ( !req.isAborted && !req.isResponded ) {
                req.cork( () => {
                    req.writeHead( res.status );

                    if ( env.isDevelopment ) req.writeHeader( "Access-Control-Allow-Origin", "*" );

                    if ( isBinary ) {
                        req.writeHeader( "Content-Type", "application/msgpack" );
                        req.end( MSGPACK.encode( res ) );
                    }
                    else {
                        req.writeHeader( "Content-Type", "application/json" );
                        req.end( JSON.stringify( res ) );
                    }
                } );
            }
        }

        async #upload ( auth, methodId, req ) {
            var file, params, paramsType;

            const formData = FormData.decode( req.stream, { "headers": req.headers } );

            formData.on( "field", ( name, value, fieldnameTruncated, valueTruncated, transferEncoding, type ) => {
                if ( name !== "params" ) return;

                paramsType = type;
                params = value;
            } );

            formData.on( "file", ( name, stream, filename, transferEncoding, type ) => {
                if ( name === "file" ) {
                    file = new File( {
                        "name": filename,
                        "path": fs.tmp.file(),
                        type,
                    } );

                    stream.pipe( fs.createWriteStream( file.path + "" ) );
                }
                else if ( name === "params" ) {
                    paramsType = type;

                    const buffers = [];

                    stream.on( "data", data => buffers.push( data ) );

                    stream.on( "end", () => {
                        if ( !buffers.length ) params = null;
                        else if ( buffers.length === 1 ) params = buffers[0];
                        else params = Buffer.concat( buffers );
                    } );
                }
            } );

            await new Promise( resolve => formData.on( "finish", resolve ) );

            var res;

            try {
                if ( !file ) {
                    throw result( [-32602, `File is required`] );
                }

                // decode params
                else if ( params ) {

                    // json
                    if ( !paramsType || paramsType.startsWith( "application/json" ) ) {
                        params = JSON.parse( params );
                    }

                    // msgpack
                    else if ( paramsType.startsWith( "application/msgpack" ) ) {
                        req.isBinary = true;

                        params = MSGPACK.decode( params );
                    }

                    // invalid content type
                    else {
                        throw result( -32803 );
                    }
                }

                if ( params === undefined ) res = await this.#call( auth, methodId, [file] );
                else res = await this.#call( auth, methodId, [file, params] );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            return res;
        }

        async #call ( auth, methodId, params, isVoid ) {

            // create public context
            const ctx = new Context( auth, true );

            if ( params === undefined ) params = [];
            else if ( !Array.isArray( params ) ) params = [params];

            if ( isVoid ) {
                ctx.callVoid( methodId, ...params );
            }
            else {
                return ctx.call( methodId, ...params );
            }
        }
    };
