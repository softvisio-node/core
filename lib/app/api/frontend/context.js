import Token from "#lib/app/api/token";
import User from "#lib/app/api/user";

export default class Context {
    #api;
    #token;
    #user;
    #isPrivate;
    #isVoid;
    #connection;
    #hostname;
    #userAgent;
    #remoteAddress;
    #method;

    constructor ( api, { token, user, connection, hostname, userAgent, remoteAddress, isPrivate, isVoid, method } = {} ) {
        this.#api = api;
        this.#token = token || new Token( api );
        this.#user = user || new User( api );
        this.#connection = connection;
        this.#hostname = hostname;
        this.#userAgent = userAgent;
        this.#remoteAddress = remoteAddress;
        this.#isPrivate = isPrivate;
        this.#isVoid = isVoid;
        this.#method = method;
    }

    // properties
    get api () {
        return this.#api;
    }

    get token () {
        return this.#token;
    }

    get user () {
        return this.#user;
    }

    get isPrivate () {
        return this.#isPrivate;
    }

    get isVoid () {
        return this.#isVoid;
    }

    get connection () {
        return this.#connection;
    }

    get hostname () {
        return this.#hostname;
    }

    get userAgent () {
        return this.#userAgent;
    }

    get remoteAddress () {
        return this.#remoteAddress;
    }

    get method () {
        return this.#method;
    }

    // auth
    get isAuthenticated () {
        return !!this.#user.id;
    }

    isEnabled () {
        if ( this.#token.id ) {
            if ( !this.#token.isEnabled ) return false;

            if ( !this.#user.isEnabled ) return false;
        }

        return true;
    }

    // public
    toJSON () {
        return this.#user.toJSON();
    }

    async call ( method, ...args ) {
        return this.#call( method, args );
    }

    voidCall ( method, ...args ) {
        this.#call( method, args, true );
    }

    updateLastActivity () {
        if ( !this.#token.id ) return;

        this.#api.apiCallLog.updateTokenLastActivity( this.#token );
    }

    // private
    // XXX
    async #call ( methodId, args, isVoid ) {

        // refresh context
        if ( this.#token.id ) {

            // api backend is down
            if ( !this.#api.isConnected ) return result( 4503 );

            let token;

            // refresh token
            if ( this.#token.isUserToken ) {
                token = await this.#api.cache.getUserTokenById( this.#token.id );
            }
            else if ( this.#token.isUserSessionToken ) {
                token = await this.#api.cache.getUserSessionById( this.#token.id );
            }

            // cached token was updated
            if ( token !== this.#token ) {

                // token was removed
                if ( !token ) {
                    this.#token = new Token( this.#api );
                    this.#user = new User( this.#api );
                }

                // token was changed
                else {
                    this.#token = token;
                }
            }

            // refresh user
            if ( this.#token.userId ) {
                const user = await this.#api.cache.getUserById( this.#token.userId );

                // cached user was updted
                if ( user !== this.#user ) {
                    if ( !user ) {
                        this.#user = new User( this.#api );
                    }
                    else {
                        this.#user = user;
                    }
                }
            }
        }

        // context is disabled
        if ( !this.isEnabled ) return result( 401 );

        // check method version
        if ( methodId.charAt( 0 ) !== "/" && this.#method ) methodId = "/v" + this.#method.version + "/" + methodId;

        const method = this.#api.frontend.schema.methods[methodId];

        // method not found
        if ( !method ) return result( -32809 );

        // check private method call from the public context
        if ( method.private && !this.isPrivate ) return result( -32805 );

        // check persistent connection
        if ( method.persistentConnectionRequired && !this.connection ) return result( -32810 );

        // check method requests limits
        if ( method.activeRequestsLimit || method.activeRequestsUserLimit ) {
            var stats = ( this.#api.requestsStats[method.id] ??= { "total": 0 } );
            stats[this.#user.id] ??= 0;

            // check request limits
            if ( ( method.activeRequestsLimit && stats.total >= method.activeRequestsLimit ) || ( method.activeRequestsUserLimit && stats[this.#user.id] > method.activeRequestsUserLimit ) ) {
                if ( this.#api.isApi && method.logApiCalls ) this.#api.apiCallLog.logDeclinedApiCall( this.#user, method );

                // too many requests
                return result( -32802 );
            }
        }

        // validate method params
        const validateParams = method.validateParams( args );
        if ( !validateParams.ok ) return validateParams;

        const aclObjectTypes = validateParams.data.aclObjectTypes;

        // error
        if ( res ) return res;

        // check acl roles
        if ( aclObjectTypes ) {
            for ( const [aclObjectId, aclObjectType] of Object.entries( aclObjectTypes ) ) {
                if ( !( await this.api.checkAclPermissions( aclObjectId, aclObjectType, this.user.id, method ) ) ) {
                    return result( -32811 );
                }
            }
        }

        // XXX
        // check session authorization
        if ( method.authorizationRequired && this.#token.isUserSessionToken ) {
            const res = await this.api.userSessions.checkSessionAuthorization( this.#token.id, this.#remoteAddress, this.#userAgent );

            if ( !res.ok ) return res;
        }

        // clone context
        const ctx = new Context( this.#api, {
            "token": this.#token,
            "user": this.#user,
            "connection": this.#connection,
            "hostname": this.#hostname,
            "userAgent": this.#userAgent,
            "remoteAddress": this.#remoteAddress,
            "isPrivate": true,
            isVoid,
            method,
        } );

        // log request start
        if ( stats ) {
            stats.total++;
            stats[this.#user.id]++;
        }

        if ( this.#api.isApi && method.logApiCalls ) {
            var logDescriptor = this.#api.apiCallLog.logApiCallStart( this.#user, method );
        }

        var res;

        // call method
        try {
            res = result.try( await method.object[method.apiName]( ctx, ...args ) );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        // decrease request limits counters
        if ( stats ) {
            stats.total--;
            stats[this.#user.id]--;
        }

        // log request finish
        if ( logDescriptor ) this.#api.apiCallLog.logApiCallFinish( logDescriptor, res );

        return res;
    }
}
