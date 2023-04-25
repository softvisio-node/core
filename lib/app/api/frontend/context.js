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
    #isPrivateCall;

    constructor ( api, { token, user, isDeleted, connection, hostname, userAgent, remoteAddress, method, isVoidCall, isPrivateCall } = {} ) {
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
        this.#isPrivateCall = !!isPrivateCall;
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

    get isPrivateCall () {
        return this.#isPrivateCall;
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
        const frontend = this.#api.frontend;

        var res;

        // reject public api calls if frontend is shutting down
        if ( frontend.isShuttingDown && !this.#isPrivateCall ) {
            res = result( 502 );
        }
        else {
            frontend.startApiCall();

            res = await this.#call1( methodId, args, isVoidCall );

            frontend.endApiCall();
        }

        return res;
    }

    async #call1 ( methodId, args, isVoidCall ) {
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

        // check static permissions
        if ( method.permission ) {

            // guest
            if ( method.permission === "guest" ) {
                if ( this.isAuthenticated ) return result( -32811 );
            }

            // user, root
            else {

                // user must be authenticated if method has any permissiona
                if ( !this.isAuthenticated ) return result( -32811 );

                // root
                if ( method.permission === "root" ) {
                    if ( !this.isRoot ) return result( -32811 );
                }
            }
        }

        // check persistent connection
        if ( method.persistentConnectionRequired && !this.#connection ) return result( -32810 );

        // check session authorization
        if ( method.authorizationRequired && this.#token.isUserSessionToken && !this.#token.checkAuthorization( this.#remoteAddress, this.#userAgent ) ) {
            return result( -32812 );
        }

        // validate method params
        const validateParams = method.validateParams( args );
        if ( !validateParams.ok ) return validateParams;

        const aclResolvers = validateParams.data.aclResolvers;

        // check acl
        if ( method.permission && !this.isRoot && !api.acl.staticPermissions.has( method.permission ) ) {

            // method requires acl resolvers
            if ( method.aclResolvers && !aclResolvers ) return result( -32811 );

            if ( !( await api.acl.checkAclPermission( this.#user.id, method.permission, aclResolvers ) ) ) {
                return result( -32811 );
            }
        }

        // check method calls limits
        if ( api.isApi ) {
            var stats;

            if ( this.#user.id ) {
                stats = api.frontend.callsStats[this.#user.id] ??= { "total": 0 };

                if ( stats.total >= api.config.frontend.totalMaxActiveCallsPerUser ) return result( -32802 );

                stats[method.id] ??= 0;

                if ( stats[method.id] >= ( method.maxActiveCallsPerUser || api.config.frontend.methodMaxActiveCallsPerUser ) ) return result( -32802 );

                stats.total++;
                stats[method.id]++;
            }
            else {
                stats = api.frontend.callsStats.guest ??= { "total": 0 };

                if ( stats.total >= api.config.frontend.totalMaxActiveCallsPerGuest ) return result( -32802 );

                stats[method.id] ??= 0;

                if ( stats[method.id] >= ( method.maxActiveCallsPerGuest || api.config.frontend.methodMaxActiveCallsPerGuest ) ) return result( -32802 );

                stats.total++;
                stats[method.id]++;
            }
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
            "isPrivateCall": this.#method ? true : this.#isPrivateCall,
            method,
        } );

        const callStartDate = new Date();

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
            stats[method.id]--;

            // XXX cleanup yser if no active requests
        }

        // XXX
        // log request
        if ( api.isApi ) {
            api.stats.logApiCall( {
                "methodId": method.id,
                "userId": this.#user.id,
                "date": callStartDate,
                "duration": Date.now() - callStartDate.getTime(),
                res,
            } );
        }

        return res;
    }
}
