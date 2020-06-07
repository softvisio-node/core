const { mixin } = require( "../mixins" );
const AuthDescriptor = require( "./auth-descriptor" );
const crypto = require( "crypto" );
const { AUTH_HASH, TOKEN_TYPE_PASSWORD } = require( "../const" );
const { isPlainObject, bytesToUuid, fromBase64u } = require( "../util" );
const result = require( "../result" );
const Lru = require( "lru-cache" );

module.exports = mixin( ( Super ) =>
    class extends Super {
            #app;

            #isInitialized;

            #cacheUser = {};
            #cacheToken;

            constructor ( app, auth ) {
                super( app, auth );

                this.#app = app;

                this.#cacheToken = new Lru( {
                    "max": 10000,
                    "dispose": ( tokenId, auth ) => {
                        if ( this.#cacheUser[auth.userId] ) delete this.#cacheUser[auth.userId][tokenId];
                    },
                } );
            }

            init () {
                if ( this.#isInitialized ) return result( 200 );

                this.#isInitialized = true;

                if ( super.init ) {
                    return super.init();
                }
                else {
                    return result( 200 );
                }
            }

            async authenticate ( api, token ) {

                // no token provided
                if ( !token ) return new AuthDescriptor( api );

                // no authentication backend
                if ( !super.authenticatePrivate ) return new AuthDescriptor( api );

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

                return this.authenticatePrivate( api, privateToken );
            }

            async authenticatePrivate ( api, privateToken ) {

                // no authentication backend
                if ( !super.authenticatePrivate ) return new AuthDescriptor( api );

                // get auth from cache by token id or user name
                const auth = this.#cacheToken.get( privateToken.id );

                if ( auth ) {
                    if ( auth.compare( privateToken ) ) {
                        return auth;
                    }

                    // token is exists in cache, but don't match private token
                    else {
                        return new AuthDescriptor( api );
                    }
                }

                var data = await super.authenticatePrivate( privateToken );

                // authenticated
                if ( data ) {
                    const auth = new AuthDescriptor( api, privateToken, data );

                    // put to cache
                    this.#cacheToken.set( privateToken.id, auth );
                    if ( !this.#cacheUser[auth.userId] ) this.#cacheUser[auth.userId] = {};
                    this.#cacheUser[auth.userId][privateToken.id] = true;

                    return auth;
                }

                // not authenticated
                else {
                    return new AuthDescriptor( api );
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
                return crypto.createHash( AUTH_HASH ).update( buffer ).digest( "base64" );
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

            // TODO currently ineffective, need noDispose on reset()
            invalidateAll () {
                this.#cacheToken.reset();

                // this.#cacheUser = {};
            }

            // VALIDATORS
            userIsRoot ( userId ) {
                return this.#app.userIsRoot( userId );
            }

            validatePassword ( password ) {
                return this.#app.validatePassword( password );
            }

            validateUserName ( userName ) {
                return this.#app.validateUserName( userName );
            }

            validateTelegramUserName ( userName ) {
                return this.#app.validateTelegramUserName( userName );
            }

            validateEmail ( email ) {
                return this.#app.validateEmail( email );
            }
    } );
