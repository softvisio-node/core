import "#index";

import Events from "events";

import CONST from "#lib/const";

export default class Auth extends Events {
    #api;
    #token;

    #isAuthenticated;
    #userId;
    #username;
    #permissions;

    constructor ( api, token, options ) {
        super();

        this.#api = api;
        this.#token = token;

        if ( options ) {
            this.#isAuthenticated = true;

            this.#userId = options.userId;
            this.#username = options.username;
            this.#permissions = options.permissions;
        }
        else {
            this.#isAuthenticated = false;

            this.#userId = CONST.GUEST_USER_ID;
            this.#username = null;
            this.#permissions = {};
        }
    }

    get api () {
        return this.#api;
    }

    get id () {
        return this.#token?.id;
    }

    get type () {
        return this.#token?.type;
    }

    get isAuthenticated () {
        return this.#isAuthenticated;
    }

    get userId () {
        return this.#userId;
    }

    get username () {
        return this.#username;
    }

    get permissions () {
        return this.#permissions;
    }

    get isRoot () {
        return this.#isAuthenticated && this.#api.userIsRoot( this.#userId );
    }

    // public
    invalidate () {
        this.#isAuthenticated = false;
        this.#userId = CONST.GUEST_USER_ID;
        this.#username = null;
        this.#permissions = {};
        this.#token = null;

        this.emit( "invalidate" );
    }

    compareToken ( token ) {
        return token.hash === this.#token?.hash;
    }

    hasPermissions ( permissions ) {

        // method has no permissions
        if ( !permissions ) return true;

        if ( !Array.isArray( permissions ) ) permissions = [permissions];

        // nothing to check
        if ( !permissions.length ) return false;

        for ( const permission of permissions ) {

            // any
            if ( permission === "*" ) return true;

            // not authenticated
            if ( permission === "guest" && !this.#isAuthenticated ) return true;

            // authenticated
            if ( permission === "user" && this.#isAuthenticated ) return true;

            // root
            if ( permission === "root" && this.isRoot ) return true;

            // compare
            if ( this.#permissions[permission] ) return true;
        }

        return false;
    }

    async hasObjectPermissions ( objectId, permissions ) {
        if ( this.isRoot ) return true;

        return this.api.hasObjectPermissions( objectId, this.#userId, permissions );
    }

    async call ( method, ...args ) {
        method = this.#api.schema.checkMethodVersion( method );

        const [error, methodSpec, stat] = await this.#startRequest( method, args );

        if ( error ) return error;

        var res;

        // call method
        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( this, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        if ( stat ) this.#finishRequest( methodSpec, res, stat );

        return res;
    }

    async callVoid ( method, ...args ) {
        method = this.schema.checkMethodVersion( method );

        const [error, methodSpec, stat] = await this.#startRequest( method, args );

        if ( error ) return error;

        var res;

        try {
            res = result.tryResult( await methodSpec.object[methodSpec.name]( this, ...args ) );
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        if ( stat ) this.#finishRequest( methodSpec, res, stat );
    }

    // private
    async #startRequest ( method, args ) {
        const methodSpec = this.#api.schema.getMethod( method );

        // method not found
        if ( !methodSpec ) return [result( [404, "Method not found"] )];

        // check permissions
        if ( !this.hasPermissions( methodSpec.permissions ) ) return [result( [403, "Insufficient permissions"] )];

        // validate method params
        const res = this.#api.schema.validateMethodParams( methodSpec, args );

        if ( !res.ok ) return [res];

        var stat = this.#api.stat;

        if ( !stat ) return [null, methodSpec];

        const userId = this.userId,
            started = new Date();

        stat = stat[method] || ( stat[method] = { "total": 0 } );

        stat[userId] ||= 0;

        // check request limits
        if ( ( methodSpec.activeRequestsLimit && stat.total >= methodSpec.activeRequestsLimit ) || ( methodSpec.activeRequestsUserLimit && stat[userId] > methodSpec.activeRequestsUserLimit ) ) {

            // log declined request
            if ( methodSpec.logApiCalls ) {
                this.#api.logApiCallLoad( {
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
        if ( methodSpec.logApiCalls && this.#api.logApiCallLoad ) {
            this.#api.logApiCallLoad( {
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
        this.#api.logApiCall( data );
    }
}
