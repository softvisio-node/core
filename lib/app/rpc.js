import Frontend from "#lib/app/api/frontend";

export default class {
    #app;
    #config;
    #frontend;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get httpServer () {
        return this.#app.privateHttpServer;
    }

    get frontend () {
        return this.#frontend;
    }

    // public
    async init () {
        var res;

        // frontend
        this.#frontend = new Frontend( this );
        res = await this.#frontend.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }
}
