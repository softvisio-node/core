const { result, parseResult } = require( "../result" );

module.exports = class AuthDescriptor {
    #api;
    #token;

    isAuthenticated = false;

    userId;
    userName;
    permissions = {};

    constructor ( api, token, options ) {
        this.#api = api;
        this.#token = token;

        Object.assign( this, options );

        if ( this.userId ) {
            this.isAuthenticated = true;
        }
        else {
            this.permissions = {};
        }
    }

    compare ( privateToken ) {
        return privateToken.hash === this.#token.hash;
    }

    isRoot () {
        return this.isAuthenticated && this.#api.userIsRoot( this.userId );
    }

    async call ( methodId, ...args ) {
        var can = await this.authorizeMethod( methodId );

        if ( !can.isOk() ) return can;

        // validate arguments
        if ( !can.data[1].validate( args ) ) return result( [400, "Method arguments are invalid, refer to the api documentation"], can.data[1].validate.errors );

        // call method
        try {
            return parseResult( await can.data[1].object[can.data[1].name]( can.data[0], ...args ) );
        }
        catch ( e ) {
            return result( [500, "Internal Server Error"] );
        }
    }

    async callVoid ( methodId, ...args ) {
        var can = await this.authorizeMethod( methodId );

        if ( !can.isOk() ) return;

        // validate arguments
        if ( !can.data[1].validate( args ) ) return;

        can.data[1].object[can.data[1].name]( can.data[0], ...args );
    }

    async authorize () {

        // re-validate private token
        return this.#token ? this.#api.authenticatePrivate( this.#token ) : this;
    }

    async authorizeMethod ( methodId ) {
        var method = this.#api.getMethod( methodId );

        if ( !method ) return result( [404, "Method not found"] );

        // check permissions
        var auth;

        // method requires permissions
        if ( method.permissions ) {

            // re-validate private token
            auth = this.#token ? await this.#api.authenticatePrivate( this.#token ) : this;

            // user is authenticated
            if ( auth.isAuthenticated ) {

                // not a root user and and method not permission "@" (any authenticated user), compare permissions
                if ( !auth.isRoot() && !method.permissions["@"] ) {
                    let allowed;

                    // compare permissions
                    for ( const permission in method.permissions ) {
                        if ( auth.permissions[permission] ) {
                            allowed = true;

                            break;
                        }
                    }

                    if ( !allowed ) auth = null;
                }
            }

            // user isn't authenticated and method don't allows access for not-authenticated users
            else if ( !method.permissions["!"] ) {
                auth = null;
            }
        }

        // method doesn't requires permissions check
        else {
            auth = this;
        }

        // insufficient permissions
        if ( !auth ) return result( [403, "Insufficient permissions"] );

        return result( 200, [auth, method] );
    }
};
