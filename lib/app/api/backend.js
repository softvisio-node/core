import Acl from "#lib/app/api/backend/components/acl";
import ApiCallLog from "#lib/app/api/backend/components/api-call-log";
import HealthCheck from "#lib/app/api/backend/components/health-check";
import User from "#lib/app/api/backend/components/user";
import UserActionTokens from "#lib/app/api/backend/components/user-action-tokens";

export default class {
    #api;
    #acl;
    #apiCallLog;
    #healthCheck;
    #user;
    #userActionTokens;

    constructor ( api ) {
        this.#api = api;
    }

    // properties
    get app () {
        return this.#api.app;
    }

    get api () {
        return this.#api;
    }

    get dbh () {
        return this.#api.app.dbh;
    }

    get acl () {
        return this.#acl;
    }

    get apiCallLog () {
        return this.#apiCallLog;
    }

    get healthCheck () {
        return this.#healthCheck;
    }

    get user () {
        return this.#user;
    }

    get userActionTokens () {
        return this.#userActionTokens;
    }

    // public
    async init () {
        var res;

        // create
        this.#acl = new Acl( this );
        this.#apiCallLog = new ApiCallLog( this );
        this.#healthCheck = new HealthCheck( this );
        this.#user = new User( this );
        this.#userActionTokens = new UserActionTokens( this );

        // init
        res = await this.#acl.init();
        if ( !res.ok ) return res;

        res = await this.#apiCallLog.init();
        if ( !res.ok ) return res;

        res = await this.#healthCheck.init();
        if ( !res.ok ) return res;

        res = await this.#user.init();
        if ( !res.ok ) return res;

        res = await this.#userActionTokens.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }
}
