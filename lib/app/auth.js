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
        var can = await this.authorize( methodId );

        if ( !can.isOk() ) return can;

        // call method
        try {
            return parseResult( await can.data[1].object[can.data[1].codeName]( can.data[0], ...args ) );
        }
        catch ( e ) {
            return result( [500, "Internal Server Error"] );
        }
    }

    async callVoid ( methodId, ...args ) {
        var can = await this.authorize( methodId );

        if ( can.isOk() ) can.data[1].object[can.data[1].codeName]( can.data[0], ...args );
    }

    async authorize ( methodId ) {
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

                // not a root user
                if ( !auth.isRoot() ) {
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

            // user is not authenticated, method not allows guest user
            else if ( !method.permissions["*"] ) {
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
