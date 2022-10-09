import Acl from "#lib/app/api/backend/components/acl";

export default class {
    #api;
    #acl;

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

        // init
        res = await this.#acl.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }
}
