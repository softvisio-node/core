export default class Context {
    #auth;
    #isPublic;
    #version;

    constructor ( auth, isPublic, version ) {
        this.#auth = auth;
        this.#isPublic = isPublic || false;
        this.#version = version;
    }

    get isPublic () {
        return this.#isPublic;
    }

    get api () {
        return this.#auth.api;
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
        this.#call( method, args );
    }

    // private
    async #call ( methodId, args ) {
        var [res, method, stat] = await this.#startRequest( methodId, args );

        // error
        if ( res ) return res;

        var ctx;

        // compare context versions
        if ( !this.#version ) {
            ctx = this;

            this.#version = method.version;
        }
        else if ( this.#version !== method.version ) {
            ctx = new Context( this.api, this.isPublic, method.version );
        }
        else {
            ctx = this;
        }

        // call method
        try {
            res = result.try( await method.object[method.APIname]( ctx, ...args ) );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        // mark context as private after first call
        this.#isPublic = false;

        if ( stat ) this.#finishRequest( method, res, stat );

        return res;
    }

    async #startRequest ( methodId, args ) {

        // check method version
        if ( methodId.charAt( 0 ) !== "/" && this.#version ) methodId = "/v" + this.#version + "/" + methodId;

        const method = this.api.schema.methods[methodId];

        // method not found
        if ( !method ) return [result( [404, "Method not found"] )];

        // re-validate authentication
        await this.#auth.authenticate();

        // XXX check private method call from public context
        // if ( this.#isPublic ) {
        // }

        // check permissions
        if ( !this.hasPermissions( method.permissions ) ) return [result( [403, "Insufficient permissions"] )];

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
            return [result( 429 )];
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
