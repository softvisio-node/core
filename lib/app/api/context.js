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
    async #call ( method, args ) {
        var [res, methodSpec, stat] = await this.#startRequest( method, args );

        // error
        if ( res ) return res;

        var ctx;

        // compare context versions
        if ( !this.#version ) {
            ctx = this;

            this.#version = methodSpec.method.apiVersion;
        }
        else if ( this.#version !== methodSpec.method.apiVersion ) {
            ctx = new Context( this.api, this.isPublic, methodSpec.method.apiVersion );
        }
        else {
            ctx = this;
        }

        // call method
        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( ctx, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        // mark context as private after first call
        this.#isPublic = false;

        if ( stat ) this.#finishRequest( methodSpec, res, stat );

        return res;
    }

    async #startRequest ( method, args ) {

        // check method version
        if ( method.charAt( 0 ) !== "/" && this.#version ) method = "/v" + this.#version + "/" + method;

        const methodSpec = this.api.schema.getMethod( method );

        // method not found
        if ( !methodSpec ) return [result( [404, "Method not found"] )];

        // XXX check private method call from public context
        // if ( this.#isPublic ) {
        // }

        // check permissions
        if ( !this.hasPermissions( methodSpec.permissions ) ) return [result( [403, "Insufficient permissions"] )];

        // validate method params
        const res = this.api.schema.validateMethodParams( methodSpec, args );

        if ( !res.ok ) return [res];

        var stat = this.api.stat;

        if ( !stat ) return [null, methodSpec];

        const userId = this.userId,
            started = new Date();

        stat = stat[method] || ( stat[method] = { "total": 0 } );

        stat[userId] ||= 0;

        // check request limits
        if ( ( methodSpec.activeRequestsLimit && stat.total >= methodSpec.activeRequestsLimit ) || ( methodSpec.activeRequestsUserLimit && stat[userId] > methodSpec.activeRequestsUserLimit ) ) {

            // log declined request
            if ( methodSpec.logApiCalls ) {
                this.api.logApiCallLoad( {
                    method,
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
        if ( methodSpec.logApiCalls && this.api.logApiCallLoad ) {
            this.api.logApiCallLoad( {
                method,
                userId,
                started,
                "isDeclined": false,
            } );
        }

        return [null, methodSpec, { stat, started, userId }];
    }

    #finishRequest ( methodSpec, res, stat ) {
        const method = methodSpec.method.id;

        // decrement stat counters
        stat.stat.total--;
        stat.stat[stat.userId]--;

        // api call log is disabled
        if ( !methodSpec.logApiCalls ) return;

        const finished = new Date();

        const data = {
            method,
            "userId": stat.userId,
            "started": stat.started,
            finished,
            "runtime": finished - stat.started,
            "isError": !res.ok,
            "isException": res.exception,
            "status": res.status,
            "reason": res.reason,
        };

        // log api call
        this.api.logApiCall( data );
    }
}
