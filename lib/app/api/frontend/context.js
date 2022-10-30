import Token from "#lib/app/api/token";
import User from "#lib/app/api/user";

export default class Context {
    #api;
    #token;
    #user;
    #isPrivate;
    #isVoid;
    #connection;
    #hostname;
    #userAgent;
    #remoteAddress;
    #method;

    constructor ( api, { token, user, connection, hostname, userAgent, remoteAddress, isPrivate, isVoid, method } = {} ) {
        this.#api = api;
        this.#token = token || new Token( api );
        this.#user = user || new User( api );
        this.#connection = connection;
        this.#hostname = hostname;
        this.#userAgent = userAgent;
        this.#remoteAddress = remoteAddress;
        this.#isPrivate = isPrivate;
        this.#isVoid = isVoid;
        this.#method = method;
    }

    // properties
    get api () {
        return this.#api;
    }

    get token () {
        return this.#token;
    }

    get user () {
        return this.#user;
    }

    get isPrivate () {
        return this.#isPrivate;
    }

    get isVoid () {
        return this.#isVoid;
    }

    get connection () {
        return this.#connection;
    }

    get hostname () {
        return this.#hostname;
    }

    get userAgent () {
        return this.#userAgent;
    }

    get remoteAddress () {
        return this.#remoteAddress;
    }

    get method () {
        return this.#method;
    }

    // auth
    get isAuthenticated () {
        return !!this.#user.id;
    }

    // public
    toJSON () {
        return this.#user.toJSON();
    }

    async call ( method, ...args ) {
        return this.#call( method, args );
    }

    voidCall ( method, ...args ) {
        this.#call( method, args, true );
    }

    // private
    // XXX
    async #call ( methodId, args, isVoid ) {
        var [res, method, stat, aclObjectTypes] = this.#startRequest( methodId, args );

        // error
        if ( res ) return res;

        // check acl roles
        if ( aclObjectTypes ) {
            for ( const [aclObjectId, aclObjectType] of Object.entries( aclObjectTypes ) ) {
                if ( !( await this.api.checkAclPermissions( aclObjectId, aclObjectType, this.user.id, method ) ) ) {
                    if ( stat ) this.#finishRequest( method, res, stat );

                    return result( -32811 );
                }
            }
        }

        // check session authorization
        if ( method.authorizationRequired && this.#token.isUserSessionToken ) {
            const res = await this.api.userSessions.checkSessionAuthorization( this.#token.id, this.#remoteAddress, this.#userAgent );

            if ( !res.ok ) {
                if ( stat ) this.#finishRequest( method, res, stat );

                return res;
            }
        }

        // clone context
        const ctx = new Context( {
            "api": this.#api,
            "token": this.#token,
            "user": this.#user,
            "connection": this.#connection,
            "hostname": this.#hostname,
            "userAgent": this.#userAgent,
            "remoteAddress": this.#remoteAddress,
            "isPrivate": true,
            isVoid,
            method,
        } );

        // call method
        try {
            res = result.try( await method.object[method.apiName]( ctx, ...args ) );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        if ( stat ) this.#finishRequest( method, res, stat );

        return res;
    }

    // XXX
    #startRequest ( methodId, args ) {

        // check method version
        if ( methodId.charAt( 0 ) !== "/" && this.#method ) methodId = "/v" + this.#method.version + "/" + methodId;

        const method = this.api.frontend.schema.methods[methodId];

        // method not found
        if ( !method ) return [result( -32809 )];

        // check private method call from the public context
        if ( method.private && !this.isPrivate ) return [result( -32805 )];

        // check persistent connection
        if ( method.persistentConnectionRequired && !this.connection ) return [result( -32810 )];

        // check roles
        // if ( !this.hasRoles( method.roles ) ) return [result( -32801 )];

        // validate method params
        const res = method.validateParams( args );
        if ( !res.ok ) return [res];

        const aclObjectTypes = res.data.aclObjectTypes;

        var stat = this.api.stat;

        if ( !stat ) return [null, method];

        const userId = this.user.id,
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
            return [result( -32802 )];
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

        return [null, method, { stat, started, userId }, aclObjectTypes];
    }

    // XXX
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
