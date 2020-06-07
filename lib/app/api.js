const fs = require( "../fs" );
const result = require( "../result" );
const { mixin } = require( "../mixins" );
const Lru = require( "lru-cache" );
const { ROOT_USER_NAME, ROOT_USER_ID, TOKEN_TYPE_PASSWORD } = require( "../const" );
const { isPlainObject, bytesToUuid, fromBase64u } = require( "../util" );
const Auth = require( "./auth" );
const crypto = require( "crypto" );

const Api = mixin( ( Super ) =>
    class extends Super {
            #methods = {};
            #cacheUser = {};
            #cacheToken;

            constructor ( app, backend ) {
                super( app, backend );

                this.#cacheToken = new Lru( {
                    "max": 10000,
                    "dispose": ( tokenId, auth ) => {
                        if ( this.#cacheUser[auth.userId] ) delete this.#cacheUser[auth.userId][tokenId];
                    },
                } );
            }

            // INIT
            // TODO
            async init ( options ) {
                const res = await super.init();

                if ( !res.isOk() ) return res;

                // load api methods
                // await this._loadMethods( options.methods.path );
            }

            // TODO load / parse spec
            async _loadMethods ( path ) {
                const files = await fs.readTree( path );

                for ( const file of files ) {
                    const version = file.substr( 0, file.indexOf( "/" ) );

                    const name = file.substr( version.length + 1 ).slice( 0, -3 );

                    const Class = require( path + "/" + file );

                    const object = new Class( {
                        "app": this.app,
                    } );

                    // TODO scan methods
                    this.#methods["/" + version + "/" + name + "/" + "test"] = {
                        version,
                        "path": name,
                        "name": "/" + version + "/" + name + "/" + "test",
                        "codeName": "API_test",
                        object,
                        "groups": {
                            "admin": true,
                            "users": false,
                        },
                    };
                }

                return result( 200 );
            }

            getMethod ( id ) {
                return this.#methods[id];
            }

            // AUTHENTICATION
            async authenticate ( token ) {

                // no token provided
                if ( !token ) return new Auth( this );

                // no authentication backend
                if ( !super.authenticatePrivate ) return new Auth( this );

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
                        "type": TOKEN_TYPE_PASSWORD,
                        "id": token[0],
                        "hash": this.getHash( token[1] + token[0] ),
                    };
                }

                // authenticate token
                else {
                    privateToken = this.unpackToken( token );
                }

                return this.authenticatePrivate( privateToken );
            }

            async authenticatePrivate ( privateToken ) {

                // no authentication backend
                if ( !super.authenticatePrivate ) return new Auth( this );

                // get auth from cache by token id or user name
                const auth = this.#cacheToken.get( privateToken.id );

                if ( auth ) {
                    if ( auth.compare( privateToken ) ) {
                        return auth;
                    }

                    // token is exists in cache, but don't match private token
                    else {
                        return new Auth( this );
                    }
                }

                var data = await super.authenticatePrivate( privateToken );

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
                    return new Auth( this );
                }
            }

            unpackToken ( token ) {
                var buf = fromBase64u( token );

                return {
                    "type": buf[16],
                    "id": bytesToUuid( buf ),
                    "hash": this.getHash( buf ),
                };
            }

            getHash ( buffer ) {
                return crypto.createHash( "SHA3-512" ).update( buffer ).digest( "base64" );
            }

            // CACHE
            invalidateUser ( userId ) {
                const tokens = this.#cacheUser[userId];

                if ( tokens ) {
                    for ( const tokenId in tokens ) {
                        this.#cacheToken.delete( tokenId );
                    }
                }
            }

            invalidateUserToken ( tokenId ) {
                this.#cacheToken.delete( tokenId );
            }

            // TODO currently is not effective, need noDispose on reset()
            invalidateAll () {
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
    } );

module.exports = function ( backend ) {
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
