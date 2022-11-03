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
        return this.#call( method, args, false );
    }

    voidCall ( method, ...args ) {
        this.#call( method, args, true );
    }

    updateLastActivity () {
        if ( !this.#token.id ) return;

        this.#api.apiCallLog.updateTokenLastActivity( this.#token );
    }

    // private
    async #call ( methodId, args, isVoid ) {
        const api = this.#api;

        // refresh context
        if ( this.#token.id ) {

            // api backend is down
            if ( !api.isConnected ) return result( 4503 );

            let token;

            // refresh token
            if ( this.#token.isUserToken ) {
                token = api.cache.getCachedUserTokenById( this.#token.id ) ?? ( await api.cache.getUserTokenById( this.#token.id ) );
            }
            else if ( this.#token.isUserSessionToken ) {
                token = api.cache.getCachedUserSessionById( this.#token.id ) ?? ( await api.cache.getUserSessionById( this.#token.id ) );
            }

            // cached token was updated
            if ( token !== this.#token ) {

                // token was removed
                if ( !token ) {
                    this.#token = new Token( api );
                    this.#user = new User( api );
                }

                // token was changed
                else {
                    this.#token = token;
                }
            }

            // refresh user
            if ( this.#token.userId ) {
                const user = api.cache.getCachedUserById( this.#token.userId ) ?? ( await api.cache.getUserById( this.#token.userId ) );

                // cached user was updted
                if ( user !== this.#user ) {
                    if ( !user ) {
                        this.#user = new User( api );
                    }
                    else {
                        this.#user = user;
                    }
                }
            }
        }

        // context is disabled
        if ( !this.isEnabled ) return result( 401 );

        // check method version, inherit version from the parent method
        if ( methodId.charAt( 0 ) !== "/" && this.#method ) methodId = "/v" + this.#method.version + "/" + methodId;

        const method = api.frontend.schema.methods[methodId];

        // method not found
        if ( !method ) return result( -32809 );

        // check private method call from the public context
        if ( method.private && !this.#isPrivate ) return result( -32805 );

        // check persistent connection
        if ( method.persistentConnectionRequired && !this.#connection ) return result( -32810 );

        // check session authorization
        if ( method.authorizationRequired && this.#token.isUserSessionToken && !this.#token.checkAuthorization( this.#remoteAddress, this.#userAgent ) ) {
            return result( -32812 );
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
                if ( !( await api.acl.checkAclPermissions( aclObjectId, aclObjectType, this.#user.id, method ) ) ) {
                    return result( -32811 );
                }
            }
        }

        // check method requests limits
        if ( method.activeRequestsLimit || method.activeRequestsUserLimit ) {
            var stats = ( api.frontend.requestsStats[method.id] ??= { "total": 0 } ),
                statsUserId = this.#user.id || "guest";

            stats[statsUserId] ??= 0;

            if ( ( method.activeRequestsLimit && stats.total >= method.activeRequestsLimit ) || ( method.activeRequestsUserLimit && stats[statsUserId] > method.activeRequestsUserLimit ) ) {
                if ( api.isApi && method.logApiCalls ) api.apiCallLog.logDeclinedApiCall( this.#user, method );

                // too many requests
                return result( -32802 );
            }

            // increase request limits counters
            stats.total++;
            stats[statsUserId]++;
        }

        // clone context
        const ctx = new Context( api, {
            "token": this.#token,
            "user": this.#user,
            "connection": this.#connection,
            "hostname": this.#hostname,
            "userAgent": this.#userAgent,
            "remoteAddress": this.#remoteAddress,
            "isPrivate": !!this.#method, // provate, if called from the other api method
            isVoid,
            method,
        } );

        // log request start
        if ( api.isApi && method.logApiCalls ) {
            var logDescriptor = api.apiCallLog.logApiCallStart( this.#user, method );
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
            stats[statsUserId]--;
        }

        // log request finish
        if ( logDescriptor ) api.apiCallLog.logApiCallFinish( logDescriptor, res );

        return res;
    }
}
