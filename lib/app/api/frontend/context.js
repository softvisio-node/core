import Token from "#lib/app/token";
import User from "#lib/app/user";

export default class Context {
    #api;
    #token;
    #user;
    #permissions;
    #isDeleted;
    #connection;
    #abortSignal;
    #hostname;
    #userAgent;
    #remoteAddress;
    #method;
    #isVoidCall;
    #isPrivateCall;

    constructor ( api, { token, user, permissions, isDeleted, connection, signal, hostname, userAgent, remoteAddress, method, isVoidCall, isPrivateCall } = {} ) {
        this.#api = api;
        this.#token = token || new Token( this.app );
        this.#user = user || new User( this.app );
        this.permissions = permissions;
        this.#isDeleted = !!isDeleted;
        this.#connection = connection;
        this.#abortSignal = signal;
        this.#hostname = hostname;
        this.#userAgent = userAgent;
        this.#remoteAddress = remoteAddress;
        this.#method = method;
        this.#isVoidCall = !!isVoidCall;
        this.#isPrivateCall = !!isPrivateCall;
    }

    // properties
    get app () {
        return this.#api.app;
    }

    get api () {
        return this.#api;
    }

    get token () {
        return this.#token;
    }

    get user () {
        return this.#user;
    }

    get permissions () {
        return this.#permissions;
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

    get abortSignal () {
        return this.#abortSignal;
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

        this.#api.frontend.updateTokenLastActivity( this.#token );
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
        if ( this.#token.isApiToken ) {
            token = this.#api.tokens.cache.getCachedTokenById( this.#token.id ) ?? ( await this.#api.tokens.cache.getTokenById( this.#token.id ) );
        }
        else if ( this.#token.isSessionToken ) {
            token = this.#api.sessions.cache.getCachedSessionById( this.#token.id ) ?? ( await this.#api.sessions.cache.getSessionById( this.#token.id ) );
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
            const user = this.app.users.getCachedUserById( this.#token.userId ) ?? ( await this.app.users.getUserById( this.#token.userId ) );

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
        var signal;

        if ( typeof methodId === "object" ) {
            ( { "method": methodId, "arguments": args, signal } = methodId );
        }

        signal ??= this.#abortSignal;

        // aborted
        if ( signal?.aborted ) return result( -32817 );

        const api = this.#api,
            frontend = api.frontend,
            isPrivateCall = this.#method ? true : this.#isPrivateCall;

        // reject public api calls if frontend is shutting down
        if ( frontend.isShuttingDown && !isPrivateCall ) {
            return result( -32816 );
        }

        // context is deleted
        if ( this.#isDeleted ) return result( -32815 );

        // check method version, inherit version from the parent method
        if ( methodId.charAt( 0 ) !== "/" && this.#method ) methodId = "/v" + this.#method.version + "/" + methodId;

        const method = api.schema.methods[ methodId ];

        // method not found
        if ( !method ) return result( -32809 );

        // method not implemented
        if ( typeof method.object[ method.apiName ] !== "function" ) return result( -32809 );

        // check persistent connection
        if ( method.persistentConnectionRequired && !this.#connection ) return result( -32810 );

        // start call
        const callDescriptor = frontend.startApiCall( {
            "activityCounter": !method.persistentConnectionRequired,
        } );

        var res;

        try {

            // update context
            if ( this.#token.id ) {

                // api backend is down
                if ( !api.isConnected ) throw result( -32814 );

                // unable to update context, api backend is down
                if ( !( await this.update() ) ) throw result( -32814 );

                // aborted
                if ( signal?.aborted ) throw result( -32817 );

                // context is deleted
                if ( this.#isDeleted ) throw result( -32815 );

                // context is disabled
                if ( !this.isEnabled ) throw result( -32813 );
            }

            // check call limits
            if ( api.isApi ) {
                const allowCall = await frontend.checkApiCallLimits( callDescriptor, this, method, isPrivateCall );

                // aborted
                if ( signal?.aborted ) throw result( -32817 );

                // too many requests
                if ( !allowCall ) throw result( -32802 );
            }

            // validate method params
            const validateParams = method.validateParams( args );

            // params not valid
            if ( !validateParams.ok ) throw validateParams;

            const permissions = await this.app.acl.resolveAclPermissions( this.#user.id, validateParams.data.aclResolvers );

            // check permissions
            if ( method.permission && !permissions.hash( method.permission ) ) throw result( -32811 );

            // check session authorization
            if ( method.authorizationRequired && this.#token.isSessionToken && !this.#token.checkAuthorization( this.#remoteAddress, this.#userAgent ) ) {
                throw result( -32812 );
            }

            // aborted
            if ( signal?.aborted ) throw result( -32817 );

            // clone context
            const ctx = new Context( api, {
                "token": this.#token,
                "user": this.#user,
                permissions,
                "connection": this.#connection,
                signal,
                "hostname": this.#hostname,
                "userAgent": this.#userAgent,
                "remoteAddress": this.#remoteAddress,
                isVoidCall,
                isPrivateCall,
                method,
            } );

            // call method
            res = await api.app.monitoring.monitorMethodCall( api.isApi ? "api" : "rpc", method.id, method.object[ method.apiName ].bind( method.object, ctx, ...args ) );
        }
        catch ( e ) {
            res = e;
        }

        // finish call
        frontend.endApiCall( callDescriptor );

        return res;
    }
}
