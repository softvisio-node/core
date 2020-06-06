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

            // TODO cache
            async authenticatePrivate ( api, privateToken ) {

                // TODO check cache

                var data = await super.authenticatePrivate( privateToken );

                // authenticated
                if ( data ) {
                    const auth = new AuthDescriptor( api, privateToken, data );

                    // TODO put to cache

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
            // TODO
            invalidateUser ( userName ) {}

            // TODO
            invalidateUserToken ( tokenId ) {}

            // TODO
            invalidateAll () {}

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
