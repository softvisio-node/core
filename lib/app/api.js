const result = require( "../result" );
const { mixin } = require( "../mixins" );
const Lru = require( "lru-cache" );
const Doc = require( "../doc" );
const { ROOT_USER_NAME, ROOT_USER_ID, TOKEN_TYPE_PASSWORD, TOKEN_TYPE_TOKEN, TOKEN_TYPE_SESSION } = require( "../const" );
const { isPlainObject, fromBase58, toMessagePack, fromMessagePack } = require( "../util" );
const { "stringify": uuidStringify } = require( "uuid" );
const Auth = require( "./auth" );
const crypto = require( "crypto" );

const API_CONNECT_TYPE_WEBSOCKET = 1;
const API_CONNECT_TYPE_GET = 2;
const API_CONNECT_TYPE_POST = 3;

const Api = mixin( Super =>
    class extends Super {
            usernameIsEmail = true;
            newUserEnabled = true;
            newUserPermissions = {};
            defaultGravatarEmail = "noname@softvisio.net"; // used, if user email is not set
            defaultGravatarImage = "identicon"; // url encoded url, 404, mp, identicon, monsterid, wavatar, retro, robohash, blank
            logApiCalls; // log api calls usage

            defaultGravatarUrl;

            #app;
            #methods = {};
            #cacheUser = {};
            #cacheToken;

            constructor ( app, backend, options = {} ) {
                super( backend );

                if ( typeof options.usernameIsEmail === "boolean" ) this.usernameIsEmail = options.usernameIsEmail;
                if ( typeof options.newUserEnabled === "boolean" ) this.newUserEnabled = options.newUserEnabled;
                if ( options.newUserPermissions ) this.newUserPermissions = options.newUserPermissions;
                if ( options.defaultGravatarEmail ) this.defaultGravatarEmail = options.defaultGravatarEmail;
                if ( options.defaultGravatarImage ) this.defaultGravatarImage = options.defaultGravatarImage;
                this.logApiCalls = options.logApiCalls;

                this.defaultGravatarUrl = `https://s.gravatar.com/avatar/${crypto.createHash( "MD5" ).update( this.defaultGravatarEmail.toLowerCase() ).digest( "hex" )}?d=${this.defaultGravatarImage}`;

                this.#app = app;

                this.#cacheToken = new Lru( {
                    "max": 10000,
                    "noDisposeOnSet": true,
                    "dispose": ( tokenId, auth ) => {
                        if ( this.#cacheUser[auth.userId] ) delete this.#cacheUser[auth.userId][tokenId];
                    },
                } );
            }

            // INIT
            async init ( options = {} ) {
                if ( !super.init ) return result( 200 );
                else return super.init( options );
            }

            // PRORS
            get app () {
                return this.#app;
            }

            get devel () {
                return this.#app.devel;
            }

            // METHODS
            async loadMethods ( path ) {
                const doc = new Doc( path ),
                    schema = await doc.getApiSchema( "" ),
                    objects = {};

                for ( const methodId in schema ) {
                    const objectId = path + "/" + schema[methodId].apiClass;

                    if ( !objects[objectId] ) {
                        const Class = require( objectId );

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

            // AUTHENTICATION
            async authenticate ( token ) {

                // no token provided
                if ( !token ) return new Auth( this );

                var privateToken;

                // already private token
                if ( isPlainObject( token ) ) {
                    privateToken = token;
                }

                // authenticate user / password
                else if ( Array.isArray( token ) ) {

                    // token is user / password
                    // lowercase user name
                    token[0] = token[0].toLowerCase();

                    // generate private token hash
                    privateToken = {
                        "privateToken": true,
                        "type": TOKEN_TYPE_PASSWORD,
                        "id": token[0],
                        "hash": this._getHash( token[1] + token[0] ), // password + username (salt)
                    };
                }

                // authenticate token
                else {
                    privateToken = this._unpackToken( token );

                    // token unpack error
                    if ( !privateToken ) return new Auth( this );
                }

                return this._authenticatePrivate( privateToken );
            }

            async _authenticatePrivate ( privateToken ) {

                // get auth from cache by token id or user name
                const auth = this.#cacheToken.get( privateToken.id );

                if ( auth ) {
                    if ( auth.compare( privateToken ) ) {
                        return auth;
                    }

                    // token is exists in cache, but don't match private token
                    else {
                        return new Auth( this, privateToken );
                    }
                }

                var data = await super._authenticatePrivate( privateToken );

                // authenticated
                if ( data ) {
                    const auth = new Auth( this, privateToken, data );

                    // put to cache
                    this.#cacheToken.set( privateToken.id, auth );
                    if ( !this.#cacheUser[auth.userId] ) this.#cacheUser[auth.userId] = {};
                    this.#cacheUser[auth.userId][privateToken.id] = true;

                    return auth;
                }

                // not authenticated
                else {
                    return new Auth( this, privateToken );
                }
            }

            _unpackToken ( token ) {
                try {
                    const type = token.charAt( 0 );

                    var id, tokenBuf;

                    // api token
                    if ( type === TOKEN_TYPE_TOKEN ) {
                        tokenBuf = fromBase58( token.substr( 1 ) );
                        id = uuidStringify( tokenBuf, tokenBuf.length - 16 );
                    }

                    // session token
                    else if ( type === TOKEN_TYPE_SESSION ) {
                        tokenBuf = Buffer.from( token.substr( 1 ), "base64" );
                        id = uuidStringify( tokenBuf, tokenBuf.length - 16 );
                    }

                    // other tokens
                    else {
                        tokenBuf = fromBase58( token.substr( 1 ) );
                        id = uuidStringify( tokenBuf, tokenBuf.length - 16 );
                    }

                    return {
                        "privateToken": true,
                        type,
                        id,
                        "hash": this._getHash( tokenBuf ),
                    };
                }
                catch ( e ) {}
            }

            _getHash ( buffer ) {
                return crypto.createHash( "SHA3-512" ).update( buffer ).digest( "base64" );
            }

            // CACHE
            _invalidateUser ( userId ) {
                const tokens = this.#cacheUser[userId];

                if ( tokens ) {
                    for ( const tokenId in tokens ) {
                        this.#cacheToken.del( tokenId );
                    }
                }
            }

            _invalidateUserToken ( tokenId ) {
                this.#cacheToken.del( tokenId );
            }

            // TODO currently is not effective, need noDispose on reset()
            _invalidateAll () {
                this.#cacheToken.reset();

                // this.#cacheUser = {};
            }

            // VALIDATORS
            userIsRoot ( userId ) {
                return userId === ROOT_USER_NAME || userId === ROOT_USER_ID;
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

                // digits only
                if ( /^\d+$/.test( username ) ) return result( [400, "User name should not contain digits only"] );

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
                if ( !/^[a-z\d][a-z\d._-]*[a-z\d]@[a-z\d.-]+$/i.test( email ) ) return result( [400, "Email is invalid"] );

                return result( 200 );
            }

            validatePermissionName ( name, allowInternals ) {
                if ( allowInternals ) {
                    if ( /[^a-z\d-!@*]/.test( name ) ) return result( [400, "Permission name is invalid"] );
                }
                else {
                    if ( /[^a-z\d-]/.test( name ) ) return result( [400, "Permission name is invalid"] );
                }

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
                        "open": this._onWebsocketOpen.bind( this ),
                        "close": this._onWebsocketClose.bind( this ),
                        "message": this._onWebsocketMessage.bind( this ),

                        // "upgrade": ( res, req, context ) => {
                        //     res.onAborted( () => ( res.isAborted = true ) );
                        // },
                        // "drain": ws => {},
                        // "ping": ws => {},
                        // "pong": ws => {},
                    },
                    "http": this._onHttpRequest.bind( this ),
                };
            }

            async _onWebsocketOpen ( ws, req ) {
                ws.subscribe( "users/*" ); // all
                ws.subscribe( "users/!" ); // not authenticated

                // store unauthenticated descriptor
                ws.auth = await this.authenticate();
            }

            _onWebsocketClose ( ws, status, reason ) {
                ws.isClosed = true;

                // reason = Buffer.from( reason );
            }

            async _onWebsocketMessage ( ws, msg, isBinary ) {

                // try to decode json
                try {
                    msg = isBinary ? fromMessagePack( Buffer.from( msg ) ) : JSON.parse( Buffer.from( msg ) );
                }
                catch ( e ) {
                    return;
                }

                // ping
                if ( msg.type === "ping" ) {

                    // do nothing
                }

                // auth
                else if ( msg.type === "auth" ) {
                    var auth = await this.authenticate( msg.token );

                    ws.auth = auth;

                    ws.unsubscribeAll();

                    if ( auth.isAuthenticated ) {
                        ws.subscribe( "users/*" ); // all
                        ws.subscribe( "users/@" ); // authenticated
                        if ( auth.isRoot() ) ws.subscribe( "users/root" );
                        ws.subscribe( "users/" + auth.userId );

                        for ( const permission in auth.permissions ) {
                            ws.subscribe( "users/@" + permission );
                        }
                    }
                    else {
                        ws.subscribe( "users/*" ); // all
                        ws.subscribe( "users/!" ); // not authenticated
                    }

                    if ( !ws.isClosed ) ws.send( toMessagePack( { "type": "auth" } ), true );
                }

                // event
                else if ( msg.type === "event" ) {
                    this.#app.emit( "user/" + msg.name, await ws.auth.authenticate(), ...msg.args );
                }

                // rpc
                else if ( msg.type === "rpc" ) {

                    // rpc request
                    if ( msg.method ) {
                        const id = msg.id,
                            auth = ws.auth,
                            stat = this._startApiCall( auth, msg.method, API_CONNECT_TYPE_WEBSOCKET );

                        // void call
                        if ( !id ) {
                            auth.callVoid( msg.method, ...msg.args );
                        }

                        // regular call
                        else {
                            const res = await auth.call( msg.method, ...msg.args );

                            if ( stat ) this._finishApiCall( stat, res );

                            if ( !ws.isClosed ) {
                                ws.send( toMessagePack( {
                                    "type": "rpc",
                                    "id": id,
                                    "result": res,
                                } ),
                                true );
                            }
                        }

                        if ( stat ) this._logApiCall( stat );
                    }
                }
            }

            async _onHttpRequest ( res, req, methodId ) {
                res.onAborted( () => {
                    res.isAborted = true;
                    req.isAborted = true;
                } );

                // get token
                var token = req.getHeader( "authorization" );

                // prepare token
                if ( token ) token = token.trim().replace( /^bearer\s+/i, "" );

                var data,
                    apiCallMethod,
                    apiRes,
                    isJSON = true,
                    stat;

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
                        apiCallMethod = API_CONNECT_TYPE_GET;

                        try {
                            const params = new URLSearchParams( req.getQuery() );

                            data = {};

                            for ( const [name, value] of params ) {
                                data[name] = value;
                            }
                        }
                        catch ( e ) {
                            apiRes = result( [400, "Bad params"] );
                        }
                    }

                    // post
                    else {
                        apiCallMethod = API_CONNECT_TYPE_POST;

                        // read request body
                        data = await new Promise( resolve => {
                            let buf = Buffer.allocUnsafe( 0 );

                            res.onData( ( chunk, isLast ) => {
                                buf = Buffer.concat( [buf, Buffer.from( chunk )] );

                                if ( isLast ) resolve( buf );
                            } );
                        } );

                        // decode json
                        if ( isJSON ) {
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
                                data = fromMessagePack( data );
                            }
                            catch ( e ) {
                                apiRes = result( [400, "Msgpack data is invalid"] );
                            }
                        }
                    }

                    if ( !apiRes ) {

                        // authenticate
                        const auth = await this.authenticate( token );

                        stat = this._startApiCall( auth, methodId, apiCallMethod );

                        // call api method
                        if ( Array.isArray( data ) ) {
                            apiRes = await auth.call( methodId, ...data );
                        }
                        else {
                            apiRes = await auth.call( methodId, data );
                        }

                        if ( stat ) this._finishApiCall( stat, apiRes );
                    }
                }

                // write response
                if ( !res.isAborted ) {
                    res.cork( () => {
                        res.writeStatus( apiRes.ok ? 200 : 400 );

                        if ( isJSON ) {
                            res.writeHeader( "Content-Type", "application/json" ).end( JSON.stringify( apiRes ) );
                        }
                        else {
                            res.writeHeader( "Content-Type", "application/msgpack" ).end( toMessagePack( apiRes ) );
                        }
                    } );
                }

                if ( stat ) this._logApiCall( stat );
            }

            // API CALL LOG
            // XXX method "-" -> "_"
            _startApiCall ( auth, methodId, apiConnectType ) {
                if ( !( this.logApiCalls && this._logApiCall ) && !this.listenerCount( "stat" ) ) return;

                const methodSpec = this.getMethod( methodId );

                if ( !methodSpec ) return;

                const stat = {
                    "methodId": methodId,
                    "apiVersion": methodSpec.method.apiVersion,
                    "apiNamespace": methodSpec.method.apiNamespace,
                    "methodName": methodSpec.method.name,
                    "userId": auth.userId,
                    "connectType": apiConnectType,
                    "started": new Date(),
                    "delay": null,
                    "isError": null,
                    "status": null,
                    "reason": null,
                };

                return stat;
            }

            _finishApiCall ( stat, res ) {
                stat.delay = new Date() - stat.started;
                stat.isError = !res.ok;
                stat.status = res.status;
                stat.reason = res.reason;
            }

            _logApiCall ( stat ) {
                if ( this.logApiCalls && this._logApiCall ) this._logApiCall( stat );

                this.emit( "stat", stat );
            }
    } );

module.exports = function getApiClass ( backend ) {
    var Super;

    // auth is not defined
    if ( !backend ) {
        Super = require( "./api/loopback" );
    }

    // auth is url
    else if ( typeof backend === "string" ) {
        const url = new URL( backend ),
            protocol = url.protocol.slice( 0, -1 );

        if ( protocol === "sqlite" ) {
            Super = require( "./api/local" );
        }
        else if ( protocol === "pgsql" ) {
            Super = require( "./api/local" );
        }
        else if ( protocol === "ws" || protocol === "wss" ) {
            Super = require( "./api/remote" );
        }
        else {
            throw `Invalid backend url "${backend}"`;
        }
    }

    // auth is dbh
    else {
        if ( backend.isSqlite ) {
            Super = require( "./api/local" );
        }
        else if ( backend.isPgsql ) {
            Super = require( "./api/local" );
        }
        else {
            throw "Backend object is not dbh";
        }
    }

    var Class = Api( Super );

    return Class;
};
