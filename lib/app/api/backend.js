import Acl from "#lib/app/api/backend/components/acl";
import ApiCallLog from "#lib/app/api/backend/components/api-call-log";
import HealthCheck from "#lib/app/api/backend/components/health-check";

export default class {
    #api;
    #acl;
    #apiCallLog;
    #healthCheck;

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

    // public
    async init () {
        var res;

        // create
        this.#acl = new Acl( this );
        this.#apiCallLog = new ApiCallLog( this );
        this.#healthCheck = new HealthCheck( this );

        // init
        res = await this.#acl.init();
        if ( !res.ok ) return res;

        res = await this.#apiCallLog.init();
        if ( !res.ok ) return res;

        res = await this.#healthCheck.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }
}
