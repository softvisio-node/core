import Permissions from "#lib/app/user/permissions";

export default class Context {
    #api;
    #token;
    #user;
    #telegramBotUser;
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

    constructor ( api, { token, user, telegramBotUser, permissions, isDeleted, connection, signal, hostname, userAgent, remoteAddress, method, isVoidCall, isPrivateCall } = {} ) {
        this.#api = api;
        this.#token = token;
        this.#user = user;
        this.#telegramBotUser = telegramBotUser;
        this.#permissions = permissions;
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

    get telegramBot () {
        return this.#telegramBotUser?.bot;
    }

    get telegramBotUser () {
        return this.#telegramBotUser;
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

    get isDeleted () {
        return this.#isDeleted;
    }

    get isEnabled () {
        if ( this.#token ) {

            // token is disabled
            if ( !this.#token.isEnabled ) return false;
        }
        else if ( this.#telegramBotUser ) {

            // telegram bot user is unsubscribed
            if ( !this.#telegramBotUser.isSubscribed ) return false;

            // telegram bot user is disabled
            if ( this.#telegramBotUser.isBanned ) return false;
        }

        if ( this.#user ) {

            // user is disabled
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
        if ( !this.#token ) return;

        // context is deleted
        if ( this.#isDeleted ) return;

        this.#api.frontend.updateTokenLastActivity( this.#token );
    }

    async update () {

        // context is deleted
        if ( this.#isDeleted ) return true;

        var userId;

        // update token
        if ( this.#token ) {
            var token;

            // refresh token
            if ( this.#token.isApiToken ) {
                token = this.#api.tokens.cache.getCachedTokenById( this.#token.id ) ?? ( await this.#api.tokens.cache.getTokenById( this.#token.id ) );
            }
            else if ( this.#token.isSessionToken ) {
                token = this.#api.sessions.cache.getCachedSessionById( this.#token.id ) ?? ( await this.#api.sessions.cache.getSessionById( this.#token.id ) );
            }

            // backend error
            if ( token === false ) {
                return false;
            }

            // token was deleted
            else if ( !token ) {
                this.#isDeleted = true;

                return true;
            }

            // store token
            else {
                this.#token = token;
            }

            userId = this.#token.userId;
        }

        // update telegram bot user
        else if ( this.#telegramBotUser ) {
            const telegramBot = this.app.telegram.bots.get( this.#telegramBotUser.bot.id );

            // telegram bot stopped / deleted
            if ( !telegramBot?.isStarted ) {
                this.#isDeleted = true;

                return true;
            }

            const telegramBotUser = await telegramBot.users.getById( this.#telegramBotUser.id );

            // backend error
            if ( telegramBotUser === false ) {
                return false;
            }

            // telegram bot user was deleted
            else if ( !telegramBotUser ) {
                this.#isDeleted = true;

                return true;
            }

            // store telegram bot user
            else {
                this.#telegramBotUser = telegramBotUser;
            }

            userId = this.#telegramBotUser.apiUserId;
        }

        // update user
        if ( userId ) {
            const user = this.app.users.getCachedUserById( userId ) ?? ( await this.app.users.getUserById( userId ) );

            // backend error
            if ( user === false ) {
                return false;
            }

            // user was deleted
            else if ( !user ) {
                this.#isDeleted = true;
            }

            // store user
            else {
                this.#user = user;
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
        if ( !methodId.startsWith( "/" ) && this.#method ) methodId = "/v" + this.#method.version + "/" + methodId;

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
            if ( this.#token || this.#telegramBotUser ) {

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

            let permissions;

            if ( api.isApi ) {
                permissions = await this.app.acl.resolveAclPermissions( this.#user?.id, validateParams.data.aclResolvers );

                // error get permissions
                if ( !permissions ) throw result( [ 500, `{ermissions check error` ] );

                // check permissions
                if ( method.permission ) {
                    if ( method.permission === "telegram-bot-users" ) {
                        if ( !this.#telegramBotUser ) throw result( -32811 );
                    }
                    else if ( !permissions.has( method.permission ) ) {
                        throw result( -32811 );
                    }
                }

                // check session authorization
                if ( method.authorizationRequired && this.#token.isSessionToken && !this.#token.checkAuthorization( this.#remoteAddress, this.#userAgent ) ) {
                    throw result( -32812 );
                }
            }
            else {
                permissions = Permissions.guestsPermissions;
            }

            // aborted
            if ( signal?.aborted ) throw result( -32817 );

            // clone context
            const ctx = new Context( api, {
                "token": this.#token,
                "user": this.#user,
                "telegramBotUser": this.#telegramBotUser,
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
