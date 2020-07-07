const result = require( "../result" );
const { mixin } = require( "../mixins" );
const Lru = require( "lru-cache" );
const Doc = require( "../doc" );
const { ROOT_USER_NAME, ROOT_USER_ID, TOKEN_TYPE_PASSWORD } = require( "../const" );
const { isPlainObject, bytesToUuid, fromBase64u, toMessagePack, fromMessagePack } = require( "../util" );
const Auth = require( "./auth" );
const crypto = require( "crypto" );

const Api = mixin( Super =>
    class extends Super {
            userNameIsEmail = true;
            newUserEnabled = true;
            newUserPermissions = {};
            defaultGravatarEmail = "noname@softvisio.net"; // used, if user email is not set
            defaultGravatarImage = "identicon"; // url encoded url, 404, mp, identicon, monsterid, wavatar, retro, robohash, blank

            defaultGravatarUrl;

            #app;
            #methods = {};
            #cacheUser = {};
            #cacheToken;

            constructor ( app, backend, options = {} ) {
                super( app, backend );

                if ( typeof options.userNameIsEmail === "boolean" ) this.userNameIsEmail = options.userNameIsEmail;
                if ( typeof options.newUserEnabled === "boolean" ) this.newUserEnabled = options.newUserEnabled;
                if ( options.newUserPermissions ) this.newUserPermissions = options.newUserPermissions;
                if ( options.defaultGravatarEmail ) this.defaultGravatarEmail = options.defaultGravatarEmail;
                if ( options.defaultGravatarImage ) this.defaultGravatarImage = options.defaultGravatarImage;

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
            async init () {
                if ( !super.init ) {
                    return result( 200 );
                }
                else {
                    return super.init();
                }
            }

            // METHODS
            async loadMethods ( path, constructorOptions = {} ) {
                const doc = new Doc( path ),
                    schema = await doc.getApiSchema( "" ),
                    objects = {};

                for ( const methodId in schema ) {
                    const objectId = path + "/" + schema[methodId].apiClass;

                    if ( !objects[objectId] ) {
                        const Class = require( objectId );

                        objects[objectId] = new Class( this.#app, this, constructorOptions );
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
                        "hash": this._getHash( token[1] + token[0] ),
                    };
                }

                // authenticate token
                else {
                    privateToken = this._unpackToken( token );
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
                var buf = fromBase64u( token );

                return {
                    "privateToken": true,
                    "type": buf[16],
                    "id": bytesToUuid( buf ),
                    "hash": this._getHash( buf ),
                };
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
            validateUserName ( userName ) {

                // check length
                if ( userName.length < 3 || userName.length > 32 ) return result( [400, "User name length must be between 3 and 32 characters"] );

                // contains forbidden chars
                if ( /[^a-z\d_@.-]/i.test( userName ) ) return result( [400, `User name must contain letters, digits, "_", "@", ".", "-" characters only`] );

                // digits only
                if ( /^\d+$/.test( userName ) ) return result( [400, "User name should not contain digits only"] );

                // looks like uuid
                if ( /^[a-f\d]{8}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{4}-[a-f\d]{12}$/i.test( userName ) ) return result( [400, "User name should not look like UUID"] );

                return result( 200 );
            }

            // accepted characters: A-z (case-insensitive), 0-9 and underscores, length: 5-32 characters
            validateTelegramUserName ( userName ) {

                // check length
                if ( userName.length < 5 || userName.length > 32 ) return result( [400, "Telegram user name length must be between 5 and 32 characters"] );

                // contains forbidden chars
                if ( /[^a-z\d_]/i.test( userName ) ) return result( [400, `Telegram user name must contain letters, digits and "_" only`] );

                return result( 200 );
            }

            validateEmail ( email ) {
                if ( !/^[a-z\d][a-z\d._-]+[a-z\d]@[a-z\d.-]+$/i.test( email ) ) return result( [400, "Email is invalid"] );

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

            // WEBSOCKET
            getWebsocketConfig () {
                return {
                    "open": this._onConnectionOpen.bind( this ),
                    "close": this._onConnectionClose.bind( this ),
                    "message": this._onConnectionMessage.bind( this ),
                };
            }

            async _onConnectionOpen ( ws, req ) {
                ws.subscribe( "users/*" ); // all
                ws.subscribe( "users/!" ); // not authenticated

                // store unauthenticated descriptor
                ws.auth = await this.authenticate();
            }

            _onConnectionClose ( ws, status, reason ) {

                // reason = Buffer.from( reason );
            }

            async _onConnectionMessage ( ws, msg, isBinary ) {

                // try to decode json
                try {
                    msg = isBinary ? fromMessagePack( Buffer.from( msg ) ) : JSON.parse( Buffer.from( msg ) );
                }
                catch ( e ) {
                    return;
                }

                // auth
                if ( msg.type === "auth" ) {
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

                    ws.send( toMessagePack( { "type": "auth" } ), true );
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
                            auth = ws.auth;

                        // void call
                        if ( !id ) {
                            auth.callVoid( msg.method, ...msg.args );
                        }

                        // regular call
                        else {
                            const res = await auth.call( msg.method, ...msg.args );

                            ws.send( toMessagePack( {
                                "type": "rpc",
                                "id": id,
                                "result": res,
                            } ),
                            true );
                        }
                    }
                }
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
