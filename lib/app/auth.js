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

    // XXX check queue
    async call ( methodId, ...args ) {
        var can = await this._authorizeMethod( methodId );

        if ( !can.ok ) return can;

        const [auth, methodSpec] = can.data;

        // validate method params
        if ( !methodSpec.noParamsValidation && !methodSpec.validate( args ) ) {

            // log validation errors
            if ( this.#api.devel ) console.log( `Params validation errors for method "${methodId}":`, methodSpec.validate.errors );

            return result( [400, "Method arguments are invalid, refer to the api documentation"] );
        }

        // stat
        const stat = this._startApiCall( methodSpec );

        let res;

        // call method
        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( auth, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        if ( stat ) await this._endApiCall( stat, auth, methodId, methodSpec, res );

        return res;
    }

    async callVoid ( methodId, ...args ) {
        var can = await this._authorizeMethod( methodId );

        if ( !can.ok ) return;

        const [auth, methodSpec] = can.data;

        // validate method params
        if ( !methodSpec.noParamsValidation && !methodSpec.validate( args ) ) {

            // log validation errors
            if ( this.#api.devel ) console.log( `Params validation errors for method "${methodId}":`, methodSpec.validate.errors );

            return;
        }

        // stat
        const stat = this._startApiCall( methodSpec );

        let res;

        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( auth, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        if ( stat ) await this._endApiCall( stat, auth, methodId, methodSpec, res );
    }

    async authenticate () {

        // re-validate private token
        return this.#token ? this.#api.authenticate( this.#token ) : this;
    }

    async _authorizeMethod ( methodId ) {
        var method = this.#api.getMethod( methodId );

        if ( !method ) return result( [404, "Method not found"] );

        // re-validate private token
        var auth = this.#token ? await this.#api.authenticate( this.#token ) : this;

        if ( !auth.hasPermissions( method.permissions ) ) return result( [403, "Insufficient permissions"] );

        return result( 200, [auth, method] );
    }

    // STAT
    _startApiCall ( methodSpec ) {
        if ( this.#api.logApiCall && methodSpec.logApiCall ) return new Date();
    }

    async _endApiCall ( start, auth, methodId, methodSpec, res ) {
        const stat = {
            "methodId": methodId,
            "apiVersion": methodSpec.method.apiVersion,
            "apiNamespace": methodSpec.method.apiNamespace,
            "methodName": methodSpec.method.name,
            "userId": auth.userId,
            "started": start,
            "isError": !res.ok,
            "isException": res.isException,
            "status": res.status,
            "reason": res.reason,
        };

        await this.#api.logApiCall( stat );
    }
};
