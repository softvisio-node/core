import Acl from "#lib/app/api/backend/components/acl";
import ApiCallLog from "#lib/app/api/backend/components/api-call-log";
import HealthCheck from "#lib/app/api/backend/components/health-check";
import User from "#lib/app/api/backend/components/user";
import UserActionTokens from "#lib/app/api/backend/components/user-action-tokens";
import UserRoles from "#lib/app/api/backend/components/user-roles";
import UserSessions from "#lib/app/api/backend/components/user-sessions";
import UserTokens from "#lib/app/api/backend/components/user-tokens";

export default class {
    #api;
    #acl;
    #apiCallLog;
    #healthCheck;
    #user;
    #userActionTokens;
    #userRoles;
    #userSessions;
    #userTokens;

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

    get userRoles () {
        return this.#userRoles;
    }

    get userSessions () {
        return this.#userSessions;
    }

    get userTokens () {
        return this.#userTokens;
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
        this.#userRoles = new UserRoles( this );
        this.#userSessions = new UserSessions( this );
        this.#userTokens = new UserTokens( this );

        // init
        res = await this.#acl.init();
        if ( !res.ok ) return res;

        res = await this.#apiCallLog.init();
        if ( !res.ok ) return res;

        res = await this.#healthCheck.init();
        if ( !res.ok ) return res;

        res = await this.#user.init();
        if ( !res.ok ) return res;

        res = await this.#userRoles.init();
        if ( !res.ok ) return res;

        res = await this.#userActionTokens.init();
        if ( !res.ok ) return res;

        res = await this.#userSessions.init();
        if ( !res.ok ) return res;

        res = await this.#userTokens.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }
}
