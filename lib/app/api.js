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
                    auth = ws.auth;

                // void call
                if ( !id ) {
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

    async #onHttpRequest ( res, req, methodId ) {
        res.onAborted( () => {
            res.isAborted = true;
            req.isAborted = true;
        } );

        // ping
        if ( methodId === "/ping" ) {
            res.end();

            return;
        }

        // pong
        else if ( methodId === "/pong" ) {
            res.end();

            return;
        }

        // healthcheck
        else if ( methodId === "/healthcheck" ) {
            const healthcheck = await this.#healthCheck();

            // write response
            if ( !res.isAborted ) {
                res.cork( () => {
                    res.writeStatus( healthcheck.ok ? 200 : 503 )
                        .writeHeader( "Content-Type", "application/json" )
                        .end( JSON.stringify( healthcheck ) );
                } );
            }

            return;
        }

        // get token
        var token = req.getHeader( "authorization" );

        const voidCall = req.getHeader( "api-call-void" ) === "true";

        // prepare token
        if ( token ) token = token.trim().replace( /^bearer\s+/i, "" );

        var data,
            apiRes,
            isJSON = true;

        // get content type
        const contentType = req.getHeader( "content-type" );

        if ( !contentType || contentType === "application/json" ) {
            isJSON = true;
        }
        else if ( contentType === "application/msgpack" ) {
            isJSON = false;
        }
        else {
            apiRes = result( [400, "Content type is invalid"] );
        }

        if ( !apiRes ) {

            // get
            if ( req.getMethod() === "get" ) {
                try {
                    let params = req.getQuery();

                    if ( params !== "" ) {
                        params = new URLSearchParams( params );

                        data = {};

                        for ( const [name, value] of params ) {
                            data[name] = value;
                        }
                    }
                }
                catch ( e ) {
                    apiRes = result( [400, "Bad params"] );
                }
            }

            // post
            else {

                // read request body
                data = await new Promise( resolve => {
                    let buf = Buffer.allocUnsafe( 0 );

                    res.onData( ( chunk, isLast ) => {
                        buf = Buffer.concat( [buf, Buffer.from( chunk )] );

                        if ( isLast ) resolve( buf );
                    } );
                } );

                if ( !data.byteLength ) {
                    data = [];
                }

                // decode json
                else if ( isJSON ) {
                    try {
                        data = JSON.parse( data );
                    }
                    catch ( e ) {
                        apiRes = result( [400, "JSON data is invalid"] );
                    }
                }

                // decode msgpack
                else {
                    try {
                        data = MSGPACK.decode( data );
                    }
                    catch ( e ) {
                        apiRes = result( [400, "Msgpack data is invalid"] );
                    }
                }
            }

            // void api call
            if ( voidCall ) ( res.isAborted = true ) && res.end();

            if ( !apiRes ) {

                // authenticate
                const auth = await this.authenticate( token );

                // call api method
                if ( data === undefined ) {
                    apiRes = await auth.call( methodId );
                }
                else if ( Array.isArray( data ) ) {
                    apiRes = await auth.call( methodId, ...data );
                }
                else {
                    apiRes = await auth.call( methodId, data );
                }
            }
        }

        // write response
        if ( !res.isAborted ) {
            res.cork( () => {
                res.writeStatus( apiRes.ok ? 200 : 400 );

                if ( process.env.NODE_ENV === "development" ) res.writeHeader( "Access-Control-Allow-Origin", "*" );

                if ( isJSON ) {
                    res.writeHeader( "Content-Type", "application/json" );
                    res.end( JSON.stringify( apiRes ) );
                }
                else {
                    res.writeHeader( "Content-Type", "application/msgpack" );
                    res.end( MSGPACK.encode( apiRes ) );
                }
            } );
        }
    }
}
