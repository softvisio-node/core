export default class Context {
    #auth;
    #options;
    #method;

    constructor ( auth, options, method ) {
        this.#auth = auth;
        this.#options = options;
        this.#method = method;

        this.#options.meta ||= {};
    }

    get isPrivate () {
        return this.#options.isPrivate;
    }

    get isVoid () {
        return this.#options.isVoid;
    }

    get isWesocket () {
        return this.#options.isWebsocket;
    }

    get meta () {
        return this.#options.meta;
    }

    get api () {
        return this.#auth.api;
    }

    get method () {
        return this.#method;
    }

    // token
    get id () {
        return this.#auth.id;
    }

    get type () {
        return this.#auth.type;
    }

    // auth
    get isAuthenticated () {
        return this.#auth.isAuthenticated;
    }

    get userId () {
        return this.#auth.userId;
    }

    get username () {
        return this.#auth.username;
    }

    get permissions () {
        return this.#auth.permissions;
    }

    get isRoot () {
        return this.#auth.isRoot;
    }

    get avatar () {
        return this.#auth.avatar;
    }

    // public
    toJSON () {
        return this.#auth.toJSON();
    }

    hasPermissions ( permissions ) {
        return this.#auth.hasPermissions( permissions );
    }

    async hasObjectPermissions ( objectId, permissions ) {
        return this.#auth.hasObjectPermissions( objectId, permissions );
    }

    async call ( method, ...args ) {
        return this.#call( method, args );
    }

    callVoid ( method, ...args ) {
        this.#call( method, args, true );
    }

    // private
    async #call ( methodId, args, isVoid ) {
        var [res, method, stat] = await this.#startRequest( methodId, args );

        // error
        if ( res ) return res;

        var ctx;

        // first call, empty context
        if ( !this.#method ) {
            ctx = this;

            this.#options.isVoid = isVoid;
            this.#method = method;
        }

        // clone context
        else {
            const options = {
                isVoid,
                "isWebsocket": this.#options.isWebsocket,
                "isPrivate": true,
            };

            ctx = new Context( this.#auth, options, method );
        }

        // call method
        try {
            res = result.try( await method.object[method.APIname]( ctx, ...args ) );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        if ( stat ) this.#finishRequest( method, res, stat );

        return res;
    }

    async #startRequest ( methodId, args ) {

        // check method version
        if ( methodId.charAt( 0 ) !== "/" && this.#method ) methodId = "/v" + this.#method.version + "/" + methodId;

        const method = this.api.schema.methods[methodId];

        // method not found
        if ( !method ) return [result( -32809 )];

        // re-validate authentication
        await this.#auth.authenticate();

        // check private method call from the public context
        if ( method.private && !this.isPrivate ) return [result( -32805 )];

        // check permissions
        if ( !this.hasPermissions( method.permissions ) ) return [result( -32801 )];

        // validate method params
        const res = method.validateParams( args );

        if ( !res.ok ) return [res];

        var stat = this.api.stat;

        if ( !stat ) return [null, method];

        const userId = this.userId,
            started = new Date();

        stat = stat[method.id] || ( stat[method.id] = { "total": 0 } );

        stat[userId] ||= 0;

        // check request limits
        if ( ( method.activeRequestsLimit && stat.total >= method.activeRequestsLimit ) || ( method.activeRequestsUserLimit && stat[userId] > method.activeRequestsUserLimit ) ) {

            // log declined request
            if ( method.logApiCalls ) {
                this.api.logApiCallLoad( {
                    "methodId": method.id,
                    userId,
                    started,
                    "isDeclined": true,
                } );
            }

            // too many requests
            return [result( -32802 )];
        }

        // increment stat counters
        stat.total++;
        stat[userId]++;

        // log accepted request
        if ( method.logApiCalls && this.api.logApiCallLoad ) {
            this.api.logApiCallLoad( {
                "methodId": method.id,
                userId,
                started,
                "isDeclined": false,
            } );
        }

        return [null, method, { stat, started, userId }];
    }

    #finishRequest ( method, res, stat ) {

        // decrement stat counters
        stat.stat.total--;
        stat.stat[stat.userId]--;

        // api call log is disabled
        if ( !method.logApiCalls ) return;

        const finished = new Date();

        const data = {
            "methodId": method.id,
            "userId": stat.userId,
            "started": stat.started,
            finished,
            "runtime": finished - stat.started,
            "isError": !res.ok,
            "isException": res.exception,
            "status": res.status,
            "statusText": res.statusText,
        };

        // log api call
        this.api.logApiCall( data );
    }
}
