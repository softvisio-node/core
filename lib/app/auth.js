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
        const started = new Date();

        // call method
        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( auth, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        await this._logApiCall( started, auth, methodId, methodSpec, res );

        return res;
    }

    async callVoid ( methodId, ...args ) {
        var res = await this._authorizeMethod( methodId, args );
        if ( !res.ok ) return;

        const [auth, methodSpec] = res.data;

        // stat
        const started = new Date();

        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( auth, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        await this._logApiCall( started, auth, methodId, methodSpec, res );
    }

    async authenticate () {

        // re-validate private token
        return this.#token ? this.#api.authenticate( this.#token ) : this;
    }

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
        const stat = this.#api.stat;
        stat.total = ( stat.total || 0 ) + 1;
        stat[auth.userId || 0] = ( stat[auth.userId || 0] || 0 ) + 1;

        // check maxRunningRequests
        if ( methodSpec.maxRunningRequests && stat.total > methodSpec.maxRunningRequests ) {
            const res = result.exception( 429 ); // too many requests

            await this._logApiCall( null, auth, methodId, methodSpec, res );

            return res;
        }

        // check maxRunningRequestsUser
        if ( methodSpec.maxRunningRequestsUser && stat[auth.userId || 0] > methodSpec.maxRunningRequestsUser ) {
            const res = result.exception( 429 ); // too many requests

            await this._logApiCall( null, auth, methodId, methodSpec, res );

            return res;
        }

        return result( 200, [auth, methodSpec] );
    }

    // XXX
    async _logApiCall ( started, auth, methodId, methodSpec, res ) {

        // decrement stat counters
        const stat = this.#api.stat;
        stat.total = ( stat.total || 0 ) - 1;
        stat[auth.userId || 0] = ( stat[auth.userId || 0] || 0 ) - 1;

        // api call log is disabled
        if ( !methodSpec.logApiCalls || !this.#api.logApiCall ) return;

        const finished = new Date();

        const data = {
            "methodId": methodId,
            "apiVersion": methodSpec.method.apiVersion,
            "apiNamespace": methodSpec.method.apiNamespace,
            "methodName": methodSpec.method.name,
            "userId": auth.userId,
            "started": started || finished,
            "finished": finished,
            "runtime": started ? finished - started : null,
            "isDeclined": !started,
            "isError": !res.ok,
            "isException": res.isException,
            "status": res.status,
            "reason": res.reason,
        };

        // log api call
        return this.#api.logApiCall( data );
    }
};
