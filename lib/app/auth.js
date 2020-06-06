const { mixin } = require( "../mixins" );
const AuthDescriptor = require( "./auth-descriptor" );
const crypto = require( "crypto" );
const { AUTH_HASH, TOKEN_TYPE_PASSWORD } = require( "../const" );
const { isPlainObject, bytesToUuid, fromBase64u } = require( "../util" );
const result = require( "../result" );

module.exports = mixin( ( Super ) =>
    class extends Super {
            #app;

            #isInitialized;

            #cacheUser = {};
            #cacheToken = {};

            constructor ( app, auth ) {
                super( app, auth );

                this.#app = app;
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

                // check cache
                const tokenCache = this.#cacheToken[privateToken.id];

                if ( tokenCache ) {
                    const auth = tokenCache.token;

                    if ( auth ) {
                        if ( auth.compare( privateToken ) ) {
                            if ( !tokenCache[api.id] ) tokenCache[api.id] = auth.clone( api );

                            return tokenCache[api.id];
                        }

                        // token is exists in cache, but don't match
                        else {
                            return new AuthDescriptor( api );
                        }
                    }
                }

                var data = await super.authenticatePrivate( privateToken );

                // authenticated
                if ( data ) {
                    const auth = new AuthDescriptor( null, privateToken, data );

                    // put to cache
                    this.#cacheToken[privateToken.id] = {
                        "token": auth,
                        [api.id]: auth.clone( api ),
                    };

                    return this.#cacheToken[privateToken.id][api.id];
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
            invalidateUser ( userName ) {
                const cache = this.#cacheUser[userName];

                if ( cache ) {
                    delete this.#cacheUser[userName];

                    for ( const tokenId in cache ) {
                        delete this.#cacheToken[tokenId];
                    }
                }
            }

            invalidateUserToken ( tokenId ) {
                const auth = this.#cacheToken[tokenId];

                if ( auth ) {
                    delete this.#cacheToken[tokenId];

                    delete this.#cacheUser[auth.userName][tokenId];
                }
            }

            invalidateAll () {
                this.#cacheUser = {};
                this.#cacheToken = {};
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
