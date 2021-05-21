export default class Context {
    #api;
    #auth;

    constructor ( api, auth ) {
        this.#api = api;
        this.#auth = auth;
    }

    get api () {
        return this.#api;
    }

    get userId () {
        return this.#auth?.userId || 0;
    }

    get username () {
        return this.#auth?.username;
    }

    get isAuthenticated () {
        return this.#auth?.isAuthenticated;
    }

    // XXX check auth.isValid
    get isRoot () {
        return this.#auth?.isRoot;
    }

    // XXX make private
    get permissions () {
        return this.#auth?.permissions;
    }

    // public
    hasPermissions ( permissions ) {

        // nothing to check
        if ( !permissions ) return false;

        if ( !Array.isArray( permissions ) ) permissions = [permissions];

        // nothing to check
        if ( !permissions.length ) return false;

        for ( const permission of permissions ) {

            // any
            if ( permission === "*" ) return true;

            // not authenticated
            if ( permission === "guest" && !this.isAuthenticated ) return true;

            // authenticated
            if ( permission === "user" && this.isAuthenticated ) return true;

            // root
            if ( permission === "root" && this.isRoot ) return true;

            // compare
            if ( this.permissions[permission] ) return true;
        }

        return false;
    }

    async hasObjectPermissions ( objectId, permissions ) {
        if ( this.isRoot ) return true;

        return this.api.hasObjectPermissions( objectId, this.userId, permissions );
    }

    async call ( method, ...args ) {
        method = this.#api.schema.checkMethodVersion( method );

        var res = await this.#startRequest( method, args );
        if ( !res.ok ) return res;

        const [methodSpec, started] = res.data;

        // call method
        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( this, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        this.#finishRequest( methodSpec, res, started );

        return res;
    }

    async callVoid ( method, ...args ) {
        method = this.schema.checkMethodVersion( method );

        var res = await this.#startRequest( method, args );
        if ( !res.ok ) return;

        const [methodSpec, started] = res.data;

        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( this, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        this.#finishRequest( methodSpec, res, started );
    }

    // private
    async #startRequest ( method, args ) {
        const methodSpec = this.#api.schema.getMethod( method );

        if ( !methodSpec ) return result( [404, "Method not found"] );

        // check permissions
        if ( !this.hasPermissions( methodSpec.permissions ) ) return result( [403, "Insufficient permissions"] );

        // validate method params
        const res = this.#api.schema.validateMethodParams( methodSpec, args );

        if ( !res.ok ) return res;

        const started = new Date(),
            stat =
                this.#api.stat[method] ||
                ( this.#api.stat[method] = {
                    "total": 0,
                } );

        stat[this.userId] ??= 0;

        // check request limits
        if ( ( methodSpec.activeRequestsLimit && stat.total >= methodSpec.activeRequestsLimit ) || ( methodSpec.activeRequestsUserLimit && stat[this.userId || 0] > methodSpec.activeRequestsUserLimit ) ) {

            // log declined request
            if ( methodSpec.logApiCalls && this.#api.logApiCallLoad ) {
                this.#api.logApiCallLoad( {
                    method,
                    "userId": this.userId,
                    started,
                    "isDeclined": true,
                } );
            }

            // too many requests
            return result( 429 );
        }

        // increment stat counters
        stat.total++;
        stat[this.userId]++;

        // log accepted request
        if ( methodSpec.logApiCalls && this.#api.logApiCallLoad ) {
            this.#api.logApiCallLoad( {
                method,
                "userId": this.userId,
                started,
                "isDeclined": false,
            } );
        }

        return result( 200, [methodSpec, started] );
    }

    #finishRequest ( methodSpec, res, started ) {
        const method = methodSpec.method.id;

        // decrement stat counters
        const stat = this.#api.stat[method];
        stat.total--;
        stat[this.userId]--;

        // api call log is disabled
        if ( !methodSpec.logApiCalls || !this.#api.logApiCall ) return;

        const finished = new Date();

        const data = {
            method,
            "userId": this.userId,
            "started": started,
            finished,
            "runtime": finished - started,
            "isError": !res.ok,
            "isException": res.exception,
            "status": res.status,
            "reason": res.reason,
        };

        // log api call
        this.#api.logApiCall( data );
    }
}
