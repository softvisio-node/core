export default class Context {
    #auth;
    #isPrivate;
    #isVoid;
    #method;
    #data;

    constructor ( auth, { isPrivate, isVoid, method, data = {} } = {} ) {
        this.#auth = auth;
        this.#isPrivate = isPrivate;
        this.#isVoid = isVoid;
        this.#method = method;
        this.#data = data;
    }

    get isPrivate () {
        return this.#isPrivate;
    }

    get isVoid () {
        return this.#isVoid;
    }

    get data () {
        return this.#data;
    }

    get api () {
        return this.#auth.api;
    }

    get method () {
        return this.#method;
    }

    // token
    get id () {
        return this.#auth.id;
    }

    get type () {
        return this.#auth.type;
    }

    // auth
    get userId () {
        return this.#auth.userId;
    }

    get username () {
        return this.#auth.username;
    }

    get locale () {
        return this.#auth.locale;
    }

    get roles () {
        return this.#auth.roles;
    }

    get isAuthenticated () {
        return this.#auth.isAuthenticated;
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

    hasRoles ( roles ) {
        return this.#auth.hasRoles( roles );
    }

    async call ( method, ...args ) {
        return this.#call( method, args );
    }

    voidCall ( method, ...args ) {
        this.#call( method, args, true );
    }

    // private
    async #call ( methodId, args, isVoid ) {
        var [res, method, stat, aclObjectTypes] = this.#startRequest( methodId, args );

        // error
        if ( res ) return res;

        // check acl roles
        if ( aclObjectTypes ) {
            for ( const [aclObjectId, aclObjectType] of Object.entries( aclObjectTypes ) ) {
                if ( !( await this.api.checkAclPermissions( aclObjectId, aclObjectType, this.userId, method ) ) ) {
                    if ( stat ) this.#finishRequest( method, res, stat );

                    return result( -32811 );
                }
            }
        }

        var ctx;

        // first call, empty context
        if ( !this.#method ) {
            ctx = this;

            this.#isVoid = isVoid;
            this.#method = method;
        }

        // clone context
        else {
            ctx = new Context( this.#auth, {
                "isPrivate": true,
                isVoid,
                method,
                "data": this.#data,
            } );
        }

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

    #startRequest ( methodId, args ) {

        // check method version
        if ( methodId.charAt( 0 ) !== "/" && this.#method ) methodId = "/v" + this.#method.version + "/" + methodId;

        const method = this.api.schema.methods[methodId];

        // method not found
        if ( !method ) return [result( -32809 )];

        // check private method call from the public context
        if ( method.private && !this.isPrivate ) return [result( -32805 )];

        // check roles
        if ( !this.hasRoles( method.roles ) ) return [result( -32801 )];

        // validate method params
        const res = method.validateParams( args );
        if ( !res.ok ) return [res];

        const aclObjectTypes = res.data.aclObjectTypes;

        var stat = this.api.stat;

        if ( !stat ) return [null, method];

        const userId = this.userId,
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
