import "#index";

import Events from "events";

export default class Auth extends Events {
    #api;
    #auth;
    #version;

    constructor ( api, auth ) {
        super();

        this.#api = api;
        this.#auth = auth;
    }

    get api () {
        return this.#api;
    }

    get id () {
        return this.#auth.id;
    }

    get type () {
        return this.#auth.type;
    }

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
    hasPermissions ( permissions ) {
        return this.#auth.hasPermissions( permissions );
    }

    async hasObjectPermissions ( objectId, permissions ) {
        return this.#auth.hasObjectPermissions( objectId, permissions );
    }

    async call ( method, ...args ) {
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

        // check method version
        if ( method.startsWith( "/v" ) ) {
            const idx = method.indexOf( "/", 3 );

            if ( idx > -1 ) {
                const version = Number.parseInt( method.substring( 2, idx ) );

                if ( !Number.isNaN( version ) ) this.#version = version;
            }
        }
        else if ( this.#version ) {
            method = "/v" + this.#version + "/" + method;
        }

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
