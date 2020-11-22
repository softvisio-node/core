const result = require( "../result" );

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

    get tokenId () {
        return this.#token ? this.#token.id : null;
    }

    get tokenType () {
        return this.#token ? this.#token.type : null;
    }

    compare ( privateToken ) {
        return privateToken.hash === this.#token.hash;
    }

    isRoot () {
        return this.isAuthenticated && this.#api.userIsRoot( this.userId );
    }

    hasPermissions ( permissions ) {

        // root user
        if ( this.isRoot() ) return true;

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

    async call ( methodId, ...args ) {
        var res = await this._authorizeMethod( methodId, args );
        if ( !res.ok ) return res;

        const [auth, methodSpec] = res.data;

        // stat
        const started = this._startRequest( methodId, methodSpec, auth );

        // call method
        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( auth, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        this._finishRequest( methodId, methodSpec, auth, res, started );

        return res;
    }

    async callVoid ( methodId, ...args ) {
        var res = await this._authorizeMethod( methodId, args );
        if ( !res.ok ) return;

        const [auth, methodSpec] = res.data;

        // stat
        const started = this._startRequest( methodId, methodSpec, auth );

        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( auth, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        this._finishRequest( methodId, methodSpec, auth, res, started );
    }

    async authenticate () {

        // re-validate private token
        return this.#token ? this.#api.authenticate( this.#token ) : this;
    }

    // XXX couters
    async _authorizeMethod ( methodId, args ) {
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

            return result( [400, "Method arguments are invalid, refer to the api documentation"] );
        }

        // increment stat counters
        const stat = this.#api.stat[methodId] || ( this.#api.stat[methodId] = {} );
        stat.total = ( stat.total || 0 ) + 1;
        stat[auth.userId || 0] = ( stat[auth.userId || 0] || 0 ) + 1;

        // check activeRequestsLimit
        if ( methodSpec.activeRequestsLimit && stat.total > methodSpec.activeRequestsLimit ) {
            const res = result( 429 ); // too many requests

            this._declineRequest( methodId, methodSpec, auth, res );

            return res;
        }

        // check activeRequestsUserLimit
        if ( methodSpec.activeRequestsUserLimit && stat[auth.userId || 0] > methodSpec.activeRequestsUserLimit ) {
            const res = result( 429 ); // too many requests

            this._declineRequest( methodId, methodSpec, auth, res );

            return res;
        }

        return result( 200, [auth, methodSpec] );
    }

    // XXX params
    _declineRequest ( methodId, methodSpec, auth, res ) {

        // decrement stat counters
        const stat = this.#api.stat[methodId] || ( this.#api.stat[methodId] = {} );
        stat.total = ( stat.total || 0 ) - 1;
        stat[auth.userId || 0] = ( stat[auth.userId || 0] || 0 ) - 1;

        // api call log is disabled
        if ( !methodSpec.logApiCalls || !this.#api.logApiCallLoad ) return;

        const started = new Date();

        this.#api.logApiCallLoad( {
            methodId,
            "userId": auth.userId,
            started,
            "isDeclined": true,
        } );
    }

    // XXX params
    _startRequest ( methodId, methodSpec, auth ) {
        const started = new Date();

        // api call log is disabled
        if ( !methodSpec.logApiCalls || !this.#api.logApiCallLoad ) return started;

        this.#api.logApiCallLoad( {
            methodId,
            "userId": auth.userId,
            started,
            "isDeclined": false,
        } );

        return started;
    }

    // XXX params
    _finishRequest ( methodId, methodSpec, auth, res, started ) {

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
            "isException": res.isException,
            "status": res.status,
            "reason": res.reason,
        };

        // log api call
        this.#api.logApiCall( data );
    }
};
