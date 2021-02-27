require( "@softvisio/core" );

module.exports = class Auth {
    #api;
    #token;

    isAuthenticated = false;

    userId;
    username;
    permissions = {};

    constructor ( api, token, options ) {
        this.#api = api;
        this.#token = token;

        Object.assign( this, options );

        if ( this.userId ) {
            this.isAuthenticated = true;
        }
        else {
            this.permissions = {};
        }
    }

    get api () {
        return this.#api;
    }

    get id () {
        return this.#token ? this.#token.id : null;
    }

    get type () {
        return this.#token ? this.#token.type : null;
    }

    get isRoot () {
        return this.isAuthenticated && this.#api.userIsRoot( this.userId );
    }

    compareToken ( token ) {
        return token.hash === this.#token.hash;
    }

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
            if ( permission === "!" && !this.isAuthenticated ) return true;

            // authenticated
            if ( permission === "@" && this.isAuthenticated ) return true;

            // compare
            if ( this.permissions[permission] ) return true;
        }

        return false;
    }

    async hasObjectPermissions ( objectId, permissions ) {
        if ( this.isRoot ) return true;

        return this.api.hasObjectPermissions( objectId, this.userId, permissions );
    }

    async call ( methodId, ...args ) {
        var res = await this.#startRequest( methodId, args );
        if ( !res.ok ) return res;

        const [auth, methodSpec, started] = res.data;

        // call method
        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( auth, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        this.#finishRequest( methodId, methodSpec, auth, res, started );

        return res;
    }

    async callVoid ( methodId, ...args ) {
        var res = await this.#startRequest( methodId, args );
        if ( !res.ok ) return;

        const [auth, methodSpec, started] = res.data;

        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( auth, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        this.#finishRequest( methodId, methodSpec, auth, res, started );
    }

    async authenticate () {

        // re-validate private token
        return this.#token ? this.#api.authenticate( this.#token ) : this;
    }

    async #startRequest ( methodId, args ) {
        var methodSpec = this.#api.getMethod( methodId );

        if ( !methodSpec ) return result( [404, "Method not found"] );

        // re-validate private token
        var auth = this.#token ? await this.#api.authenticate( this.#token ) : this;

        // check permissions
        if ( !auth.hasPermissions( methodSpec.permissions ) ) return result( [403, "Insufficient permissions"] );

        // validate method params
        if ( !methodSpec.noParamsValidation && !methodSpec.validate( args ) ) {

            // log validation errors
            if ( this.#api.devel ) console.log( `Params validation errors for method "${methodId}":`, methodSpec.validate.errors );

            return result( [400, methodSpec.validate.errors.map( e => e.message ).join( "\n" )] );
        }

        const started = new Date(),
            stat = this.#api.stat[methodId] || ( this.#api.stat[methodId] = {} );

        // check request imits
        if ( ( methodSpec.activeRequestsLimit && ( stat.total || 0 ) >= methodSpec.activeRequestsLimit ) || ( methodSpec.activeRequestsUserLimit && ( stat[auth.userId || 0] || 0 ) > methodSpec.activeRequestsUserLimit ) ) {

            // too many requests
            const res = result( 429 );

            // log declined request
            if ( methodSpec.logApiCalls && this.#api.logApiCallLoad ) {
                this.#api.logApiCallLoad( {
                    methodId,
                    "userId": auth.userId,
                    started,
                    "isDeclined": true,
                } );
            }

            return res;
        }

        // increment stat counters
        stat.total = ( stat.total || 0 ) + 1;
        stat[auth.userId || 0] = ( stat[auth.userId || 0] || 0 ) + 1;

        // log accepted request
        if ( methodSpec.logApiCalls && this.#api.logApiCallLoad ) {
            this.#api.logApiCallLoad( {
                methodId,
                "userId": auth.userId,
                started,
                "isDeclined": false,
            } );
        }

        return result( 200, [auth, methodSpec, started] );
    }

    #finishRequest ( methodId, methodSpec, auth, res, started ) {

        // decrement stat counters
        const stat = this.#api.stat[methodId] || ( this.#api.stat[methodId] = {} );
        stat.total = ( stat.total || 0 ) - 1;
        stat[auth.userId || 0] = ( stat[auth.userId || 0] || 0 ) - 1;

        // api call log is disabled
        if ( !methodSpec.logApiCalls || !this.#api.logApiCall ) return;

        const finished = new Date();

        const data = {
            methodId,
            "userId": auth.userId,
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
};
