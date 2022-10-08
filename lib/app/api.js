import Backend from "#lib/app/api/backend";
import Frontend from "#lib/app/api/frontend";

export default class {
    #app;
    #config;
    #dbh;
    #backend;
    #frontend;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
        this.#dbh = app.dbh;
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dbh () {
        return this.#dbh;
    }

    get httpServer () {
        return this.#app.publicHttpServer;
    }

    get backend () {
        return this.#backend;
    }

    get frontend () {
        return this.#frontend;
    }

    // public
    async init () {
        var res;

        // backend
        this.#backend = new Backend( this );
        res = await this.#frontend.init();
        if ( !res.ok ) return res;

        // frontend
        this.#frontend = new Frontend( this );
        res = await this.#frontend.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }
}
