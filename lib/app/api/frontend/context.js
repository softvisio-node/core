import Token from "#lib/app/api/token";
import User from "#lib/app/api/user";

export default class Context {
    #api;
    #token;
    #user;
    #isDeleted;
    #connection;
    #hostname;
    #userAgent;
    #remoteAddress;
    #method;
    #isVoidCall;

    constructor ( api, { token, user, isDeleted, connection, hostname, userAgent, remoteAddress, method, isVoidCall } = {} ) {
        this.#api = api;
        this.#token = token || new Token( api );
        this.#user = user || new User( api );
        this.#isDeleted = !!isDeleted;
        this.#connection = connection;
        this.#hostname = hostname;
        this.#userAgent = userAgent;
        this.#remoteAddress = remoteAddress;
        this.#method = method;
        this.#isVoidCall = !!isVoidCall;
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

    get isVoidCall () {
        return this.#isVoidCall;
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
        return this.#user.isAuthenticated;
    }

    get isRoot () {
        return this.#user.isRoot;
    }

    get isDeleted () {
        return this.#isDeleted;
    }

    get isEnabled () {
        if ( this.#token.id ) {
            if ( !this.#token.isEnabled ) return false;

            if ( !this.#user.isEnabled ) return false;
        }

        return true;
    }

    // public
    async call ( method, ...args ) {
        return this.#call( method, args, false );
    }

    voidCall ( method, ...args ) {
        this.#call( method, args, true );
    }

    updateLastActivity () {
        if ( !this.#token.id ) return;

        // context is deleted
        if ( this.#isDeleted ) return;

        this.#api.stats.logTokenLastActivity( this.#token );
    }

    async update () {

        // context is deleted
        if ( this.#isDeleted ) return true;

        // not authenticated
        if ( !this.#token.id ) return true;

        // api backend is down
        if ( !this.#api.isConnected ) return false;

        var token;

        // refresh token
        if ( this.#token.isUserToken ) {
            token = this.#api.cache.getCachedUserTokenById( this.#token.id ) ?? ( await this.#api.cache.getUserTokenById( this.#token.id ) );
        }
        else if ( this.#token.isUserSessionToken ) {
            token = this.#api.cache.getCachedUserSessionById( this.#token.id ) ?? ( await this.#api.cache.getUserSessionById( this.#token.id ) );
        }

        // backend error
        if ( token === false ) return false;

        // cached token was updated
        if ( token !== this.#token ) {

            // token was deleted
            if ( !token ) {
                this.#isDeleted = true;

                return true;
            }

            // token was changed
            else {
                this.#token = token;
            }
        }

        // refresh user
        if ( this.#token.userId ) {
            const user = this.#api.cache.getCachedUserById( this.#token.userId ) ?? ( await this.#api.cache.getUserById( this.#token.userId ) );

            // backend error
            if ( user === false ) return false;

            // cached user was updted
            if ( user !== this.#user ) {

                // user was deleted
                if ( !user ) {
                    this.#isDeleted = true;
                }

                // user was changed
                else {
                    this.#user = user;
                }
            }
        }

        return true;
    }

    // private
    async #call ( methodId, args, isVoidCall ) {
        const api = this.#api;

        // context is deleted
        if ( this.#isDeleted ) return result( -32815 );

        // update context
        if ( this.#token.id ) {

            // api backend is down
            if ( !api.isConnected ) return result( -32814 );

            // unable to update context, api backend is down
            if ( !( await this.update() ) ) return result( -32814 );

            // context is deleted
            if ( this.#isDeleted ) return result( -32815 );

            // context is disabled
            if ( !this.isEnabled ) return result( -32813 );
        }

        // check method version, inherit version from the parent method
        if ( methodId.charAt( 0 ) !== "/" && this.#method ) methodId = "/v" + this.#method.version + "/" + methodId;

        const method = api.frontend.schema.methods[methodId];

        // method not found
        if ( !method ) return result( -32809 );

        // check user is authenticated
        if ( method.permission && !this.isAuthenticated ) return result( -32811 );

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

        // check acl
        if ( method.permission && !this.isRoot ) {

            // default acl
            if ( !aclObjectTypes ) {
                if ( !( await api.acl.checkAclPermissions( null, null, this.#user.id, method ) ) ) {
                    return result( -32811 );
                }
            }

            // dynamic acl
            else {
                for ( const [aclObjectId, aclObjectType] of Object.entries( aclObjectTypes ) ) {
                    if ( !( await api.acl.checkAclPermissions( aclObjectId, aclObjectType, this.#user.id, method ) ) ) {
                        return result( -32811 );
                    }
                }
            }
        }

        // check method requests limits
        if ( method.activeRequestsLimit || method.activeRequestsUserLimit ) {
            var stats = ( api.frontend.requestsStats[method.id] ??= { "total": 0 } );

            // check total limit
            if ( method.activeRequestsLimit && stats.total >= method.activeRequestsLimit ) {
                if ( api.isApi && method.logApiCalls ) api.stats.logDeclinedApiCall( this.#user, method );

                // too many requests
                return result( -32802 );
            }

            // check user limit
            if ( method.activeRequestsUserLimit ) {
                var statsUserId = this.#user.id || "guest";

                stats[statsUserId] ??= 0;

                if ( stats[statsUserId] >= method.activeRequestsUserLimit ) {
                    if ( api.isApi && method.logApiCalls ) api.stats.logDeclinedApiCall( this.#user, method );

                    // too many requests
                    return result( -32802 );
                }

                // increase user requests counter
                stats[statsUserId]++;
            }

            // increase total requests counter
            stats.total++;
        }

        // clone context
        const ctx = new Context( api, {
            "token": this.#token,
            "user": this.#user,
            "connection": this.#connection,
            "hostname": this.#hostname,
            "userAgent": this.#userAgent,
            "remoteAddress": this.#remoteAddress,
            isVoidCall,
            method,
        } );

        // log request start
        if ( api.isApi && method.logApiCalls ) {
            var logDescriptor = api.stats.logApiCallStart( this.#user, method );
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

            if ( statsUserId ) {
                stats[statsUserId]--;

                if ( !stats[statsUserId] ) delete stats[statsUserId];
            }
        }

        // log request finish
        if ( logDescriptor ) api.stats.logApiCallFinish( logDescriptor, res );

        return res;
    }
}
