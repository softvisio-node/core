import Frontend from "#lib/app/api/frontend";
import Validate from "#lib/app/api/validate";

export default class AppRpc {
    #app;
    #config;
    #validate;
    #frontend;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get isRpc () {
        return true;
    }

    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get httpServer () {
        return this.#app.privateHttpServer;
    }

    get validate () {
        return this.#validate;
    }

    get frontend () {
        return this.#frontend;
    }

    // public
    async init () {
        var res;

        this.#validate = new Validate( this );

        // frontend
        this.#frontend = new Frontend( this );
        res = await this.#frontend.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }
}
