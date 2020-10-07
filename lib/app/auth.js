const { result, parseResult } = require( "../result" );

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
        var can = await this._authorizeMethod( methodId );

        if ( !can.ok ) return can;

        // validate method params
        if ( !can.data[1].noParamsValidation && !can.data[1].validate( args ) ) {

            // log validation errors
            if ( this.#api.devel ) console.log( `Params validation errors for method "${methodId}":`, can.data[1].validate.errors );

            return result( [400, "Method arguments are invalid, refer to the api documentation"] );
        }

        // call method
        try {
            return parseResult( await can.data[1].object[can.data[1].name]( can.data[0], ...args ) );
        }
        catch ( e ) {
            console.log( e );

            return result( [500, "Internal Server Error"] );
        }
    }

    async callVoid ( methodId, ...args ) {
        var can = await this._authorizeMethod( methodId );

        if ( !can.ok ) return;

        // validate method params
        if ( !can.data[1].noParamsValidation && !can.data[1].validate( args ) ) {

            // log validation errors
            if ( this.#api.devel ) console.log( `Params validation errors for method "${methodId}":`, can.data[1].validate.errors );

            return;
        }

        try {
            can.data[1].object[can.data[1].name]( can.data[0], ...args );
        }
        catch ( e ) {
            console.log( e );
        }
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
};
