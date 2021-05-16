import MSGPACK from "#lib/msgpack";
import fs from "#lib/fs";
import FormData from "#lib/form-data";
import File from "#lib/file";
import env from "#lib/env";

import CONST from "#lib/const";

export default Super =>
    class Connection extends ( Super || Object ) {
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

                    // "upgrade": ( res, req, context ) => {
                    //     res.onAborted( () => ( res.isAborted = true ) );
                    // },
                    // "drain": ws => {},
                    // "ping": ( ws, msg ) => console.log( "ping", msg ),
                    // "pong": ( ws, msg ) => console.log( "pong", new Date() ),
                },
                "http": this.#onHttpRequest.bind( this ),
            };
        }

        async #onWebsocketOpen ( ws, req ) {
            ws.subscribe( ":users:*" ); // all
            ws.subscribe( ":users:guest" ); // not authenticated

            // store unauthenticated descriptor
            ws.auth = await this.authenticate();
        }

        #onWebsocketClose ( ws, status, reason ) {
            ws.isClosed = true;

            // reason = Buffer.from( reason );
        }

        async #onWebsocketMessage ( ws, msg, isBinary ) {

            // try to decode json
            try {
                msg = isBinary ? MSGPACK.decode( msg ) : JSON.parse( Buffer.from( msg ) );
            }
            catch ( e ) {
                return;
            }

            // ping
            if ( msg.type === "ping" ) {

                // response with pong, if required
                if ( msg.id ) this.#wsSend( ws, isBinary, { "type": "pong", "id": msg.id } );
            }

            // pong
            else if ( msg.type === "pong" ) {

                // do nothing
            }

            // auth
            else if ( msg.type === "auth" ) {
                var auth = await this.authenticate( msg.token );

                ws.auth = auth;

                // unsubscribe from all topics
                for ( const topic of ws.getTopics() ) ws.unsubscribe( topic );

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

                this.#wsSend( ws, isBinary, { "type": "auth" } );
            }

            // event
            else if ( msg.type === "event" ) {
                this.app.publish( "user/" + msg.name, await ws.auth.authenticate(), ...msg.args );
            }

            // rpc
            else if ( msg.type === "rpc" ) {

                // rpc request
                if ( msg.method ) {
                    const id = msg.id,
                        auth = ws.auth,
                        method = this.getMethod( msg.method );

                    // upload, invalid usage
                    if ( method.upload ) {
                        if ( id ) this.#wsSend( ws, isBinary, { "type": "rpc", "id": id, "result": result( [400, `Upload using websockets is not supported`] ) } );
                    }

                    // void call
                    else if ( !id ) {
                        auth.callVoid( msg.method, ...( msg.args || [] ) );
                    }

                    // regular call
                    else {
                        const res = await auth.call( msg.method, ...( msg.args || [] ) );

                        this.#wsSend( ws, isBinary, { "type": "rpc", "id": id, "result": res } );
                    }
                }
            }
        }

        #wsSend ( ws, isBinary, msg ) {
            if ( ws.isClosed ) return;

            if ( isBinary ) ws.send( MSGPACK.encode( msg ), true );
            else ws.send( JSON.stringify( msg ), false );
        }

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

            var data, res, isBinary, isUpload;

            const method = this.getMethod( methodId );

            try {

                // get content type
                const contentType = req.getHeader( "content-type" );

                // upload
                if ( method?.upload ) {
                    if ( !contentType.startsWith( "multipart/form-data" ) ) throw result( 415 ); // 415 - Unsupported Media Type

                    const size = req.headers["content-length"];

                    // check max. size
                    if ( !size ) throw result( 411 ); // 411 - Length Required
                    if ( size > ( method.uploadMaxSize || CONST.DEFAULT_UPLOAD_MAX_SIZE ) ) throw result( 413 ); // 413 - Payload Too Large

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
                    throw result( 415 ); // 415 - Unsupported Media Type
                }

                // get token
                var token = req.getHeader( "authorization" );

                // prepare token
                if ( token ) token = token.trim().replace( /^bearer\s+/i, "" );

                const voidCall = req.getHeader( "api-call-void" ) === "true";

                // upload
                if ( isUpload ) {
                    if ( req.method !== "post" ) throw result( 405 ); // 405 - Method Not Allowed

                    // get and cache headers before await call
                    req.headers;
                }

                // get
                else if ( req.method === "get" ) {
                    try {
                        data = {};

                        for ( const [name, value] of req.searchParams ) data[name] = value;
                    }
                    catch ( e ) {
                        throw result( [400, "Bad params"] );
                    }
                }

                // post
                else if ( req.method === "post" ) {

                    // read request body
                    data = await req.buffer();

                    if ( !data.byteLength ) {
                        data = [];
                    }

                    // decode msgpack
                    else if ( isBinary ) {
                        try {
                            data = MSGPACK.decode( data );
                        }
                        catch ( e ) {
                            throw result( [400, "Msgpack data is invalid"] );
                        }
                    }

                    // decode json
                    else {
                        try {
                            data = JSON.parse( data );
                        }
                        catch ( e ) {
                            throw result( [400, "JSON data is invalid"] );
                        }
                    }
                }

                // invalid method
                else {
                    throw result( 405 ); // 405 - Method Not Allowed
                }

                // void api call
                if ( voidCall ) req.end();

                // authenticate
                const auth = await this.authenticate( token );

                // call api method
                if ( isUpload ) {

                    // check permissions
                    if ( !auth.hasPermissions( method.permissions ) ) throw result( [403, "Insufficient permissions"] );

                    res = await this.#upload( auth, methodId, req );

                    isBinary = req.isBinary;
                }
                else if ( data === undefined ) {
                    res = await auth.call( methodId );
                }
                else if ( Array.isArray( data ) ) {
                    res = await auth.call( methodId, ...data );
                }
                else {
                    res = await auth.call( methodId, data );
                }
            }
            catch ( e ) {
                res = result.catchResult( e );
            }

            // write response
            if ( !req.isAborted && !req.isResponded ) {
                req.cork( () => {
                    req.writeHead( 200 );

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
            var file, data, dataType;

            const formData = FormData.decode( req.stream, { "headers": req.headers } );

            formData.on( "field", ( name, value, fieldnameTruncated, valueTruncated, transferEncoding, type ) => {
                if ( name !== "data" ) return;

                dataType = type;
                data = value;
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
                else if ( name === "data" ) {
                    dataType = type;

                    const buffers = [];

                    stream.on( "data", data => buffers.push( data ) );

                    stream.on( "end", () => {
                        if ( !buffers.length ) data = null;
                        else if ( buffers.length === 1 ) data = buffers[0];
                        else data = Buffer.concat( buffers );
                    } );
                }
            } );

            await new Promise( resolve => formData.on( "finish", resolve ) );

            var res;

            try {
                if ( !file ) {
                    throw result( [424, `File is required`] );
                }

                // decode data
                else if ( data ) {

                    // json
                    if ( !dataType || dataType.startsWith( "application/json" ) ) {
                        data = JSON.parse( data );
                    }

                    // msgpack
                    else if ( dataType.startsWith( "application/msgpack" ) ) {
                        req.isBinary = true;

                        data = MSGPACK.decode( data );
                    }

                    // invalid content type
                    else {
                        throw result( 415 ); // 415 - Unsupported Media Type
                    }
                }

                if ( data === undefined ) res = await auth.call( methodId, file );
                else res = await auth.call( methodId, file, data );
            }
            catch ( e ) {
                res = result.catchResult( e );
            }

            return res;
        }
    };
