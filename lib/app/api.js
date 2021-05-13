import mixins from "#lib/mixins";
import Local from "./api/local.js";
import Events from "events";
import Doc from "#lib/doc";
import CONST from "#lib/const";
import MSGPACK from "#lib/msgpack";
import Auth from "./auth.js";
import Token from "./token.js";
import crypto from "crypto";
import Mutex from "#lib/threads/mutex";
import AuthCache from "./api/auth-cache.js";
import _url from "url";
import FormData from "#lib/form-data";
import fs from "#lib/fs";
import File from "#lib/file";

export default class Api extends mixins( Local, Events ) {
    usernameIsEmail = true;
    newUserEnabled = true;
    defaultGravatarEmail = "noname@softvisio.net"; // used, if user email is not set
    defaultGravatarImage = "identicon"; // url encoded url, 404, mp, identicon, monsterid, wavatar, retro, robohash, blank

    defaultGravatarUrl;

    #app;
    #methods = {};
    #logMethods;
    #stat = {};

    #authCache;

    #healthCheckState;
    #healthCheckUpdateInterval = 1000;
    #healthCheckLastUpdated;
    #healthCheckMutex = new Mutex();

    static async new ( app, backend, options = {} ) {
        const api = new this( app, backend, options );

        // init api
        const res = await api._init( options );

        if ( !res.ok ) {
            console.log( "TERMINATED" );

            return;
        }

        return api;
    }

    constructor ( app, backend, options = {} ) {
        super( backend );

        if ( typeof options.usernameIsEmail === "boolean" ) this.usernameIsEmail = options.usernameIsEmail;
        if ( typeof options.newUserEnabled === "boolean" ) this.newUserEnabled = options.newUserEnabled;
        if ( options.defaultGravatarEmail ) this.defaultGravatarEmail = options.defaultGravatarEmail;
        if ( options.defaultGravatarImage ) this.defaultGravatarImage = options.defaultGravatarImage;
        if ( options.healthCheckUpdateInterval ) this.#healthCheckUpdateInterval = options.healthCheckUpdateInterval;

        this.defaultGravatarUrl = `https://s.gravatar.com/avatar/${crypto.createHash( "MD5" ).update( this.defaultGravatarEmail.toLowerCase() ).digest( "hex" )}?d=${this.defaultGravatarImage}`;

        this.#app = app;
    }

    // INIT
    async _init ( options = {} ) {
        var res;

        if ( super._init ) res = await super._init( options );

        if ( !res.ok ) return res;

        // init methods
        process.stdout.write( "Loading methods ... " );
        if ( options.methods ) res = await this.#loadMethods( options.methods );
        console.log( res + "" );
        if ( !res.ok ) return res;

        // init auth cache
        this.#authCache = new AuthCache( this, 10000 );
        await this.dbh.on( "event/api/auth-cache/invalidate/user", userId => this.#authCache.invalidateUser( userId ) );
        await this.dbh.on( "event/api/auth-cache/invalidate/user-token", tokenId => this.#authCache.invalidateUserToken( tokenId ) );
        this.dbh.on( "disconnect", () => this.#authCache.invalidateAll() );

        return result( 200 );
    }

    // PRORS
    get app () {
        return this.#app;
    }

    get stat () {
        return this.#stat;
    }

    // METHODS
    // XXX pat url to doc
    async #loadMethods ( url ) {
        const path = _url.fileURLToPath( url ),
            doc = new Doc( path ),
            schema = await doc.getApiSchema( "" ),
            objects = {};

        for ( const methodId in schema ) {

            // validate permissions
            const res = this.validateApiPermissions( schema[methodId].permissions );

            // permissions are invalid
            if ( !res.ok ) return res;

            const objectId = _url.pathToFileURL( path + "/" + schema[methodId].apiClass + ".js" ).href;

            if ( !objects[objectId] ) {
                const Class = ( await import( objectId ) ).default;

                objects[objectId] = new Class( this );
            }

            schema[methodId].object = objects[objectId];
        }

        this.#methods = schema;

        return result( 200 );
    }

    getMethod ( id ) {
        return this.#methods[id];
    }

    findMethod ( id ) {
        const params = [];

        if ( this.#methods[id] ) return [id, params];

        while ( 1 ) {
            const id1 = id.replace( /_/g, "-" );

            if ( this.#methods[id1] ) return [id1, params];

            const idx = id.lastIndexOf( "/" );

            if ( idx === -1 ) return [null, params];

            params.unshift( id.substr( idx + 1 ) );

            id = id.substr( 0, idx );
        }
    }

    getLogMethods () {
        if ( !this.#logMethods ) {
            this.#logMethods = {};

            for ( const methodId of Object.keys( this.#methods ).sort() ) {
                if ( this.#methods[methodId].logApiCalls ) this.#logMethods[methodId] = this.#methods[methodId];
            }
        }

        return this.#logMethods;
    }

    // AUTHENTICATION
    async authenticate ( token ) {

        // no token provided
        if ( !token ) return new Auth( this );

        // parse token
        token = Token.new( token );

        // token parsing error
        if ( !token ) return new Auth( this );

        // get auth from cache by token id or user name
        // do not use cache if cluster is initialized but no connected
        const auth = this.#authCache.get( token );

        if ( auth ) {
            if ( auth.compareToken( token ) ) {
                return auth;
            }

            // token is exists in cache, but don't match private token
            else {
                return new Auth( this, token );
            }
        }

        var data = await super.authenticate( token );

        // authenticated
        if ( data ) {
            const auth = new Auth( this, token, data );

            // put to cache, if cluster is ready to use
            this.#authCache.set( token, auth );

            return auth;
        }

        // not authenticated
        else {
            return new Auth( this, token );
        }
    }

    // VALIDATORS
    userIsRoot ( userId ) {
        return userId + "" === CONST.ROOT_USER_ID || userId === CONST.ROOT_USER_NAME;
    }

    validatePassword ( password ) {
        if ( password.length < 1 ) return result( [400, "Password must contain at least 1 character"] );

        return result( 200 );
    }

    // accepted characters: A-z (case-insensitive), 0-9, "_", "-", "@", ".", length: 3-32 characters, not number, not UUID
    validateUsername ( username ) {

        // check length
        if ( username.length < 3 || username.length > 32 ) return result( [400, "User name length must be between 3 and 32 characters"] );

        // contains forbidden chars
        if ( /[^a-z\d_@.-]/i.test( username ) ) return result( [400, `User name must contain letters, digits, "_", "@", ".", "-" characters only`] );

        // number
        if ( !isNaN( username ) ) return result( [400, "User name should not be a number"] );

        // looks like uuid
        if ( /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test( username ) ) return result( [400, "User name should not look like UUID"] );

        return result( 200 );
    }

    // accepted characters: A-z (case-insensitive), 0-9 and underscores, length: 5-255 characters
    validateTelegramUsername ( username ) {

        // check length
        if ( username.length < 5 || username.length > 255 ) return result( [400, "Telegram user name length must be between 5 and 32 characters"] );

        // contains forbidden chars
        if ( /[^a-z\d_]/i.test( username ) ) return result( [400, `Telegram user name must contain letters, digits and "_" only`] );

        return result( 200 );
    }

    validateEmail ( email ) {
        if ( !/^[a-z\d][a-z\d._-]*[a-z\d]@(?:[a-z\d][a-z\d-]*.)+[a-z\d][a-z\d-]*[a-z\d]$/i.test( email ) ) return result( [400, "Email is invalid"] );

        return result( 200 );
    }

    // HEALTHCHECK
    async #healthCheck () {

        // return cached result
        if ( this.#healthCheckLastUpdated && this.#healthCheckUpdateInterval && new Date() - this.#healthCheckLastUpdated < this.#healthCheckUpdateInterval ) {
            return this.#healthCheckState;
        }

        if ( this.#healthCheckMutex.tryDown() ) {

            // run health check
            try {
                this.#healthCheckState = await this.healthCheck();
            }
            catch ( e ) {
                this.#healthCheckState = result( 500 );
            }

            this.#healthCheckLastUpdated = new Date();

            this.#healthCheckMutex.up();

            this.#healthCheckMutex.signal.broadcast();
        }
        else {
            await this.#healthCheckMutex.signal.wait();
        }

        return this.#healthCheckState;
    }

    async healthCheck () {
        return result( 200 );
    }

    // HTTP SERVER
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
            this.#app.publish( "user/" + msg.name, await ws.auth.authenticate(), ...msg.args );
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
            const healthcheck = await this.#healthCheck();

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

                if ( process.env.NODE_ENV === "development" ) req.writeHeader( "Access-Control-Allow-Origin", "*" );

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
}
