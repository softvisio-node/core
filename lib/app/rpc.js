import Events from "#lib/events";
import Auth from "#lib/app/api/auth";
import Frontend from "#lib/app/api/frontend";

import Validate from "#lib/app/api/components/validate";

export default class AppRpc extends Events {
    #app;
    #config;
    #frontend;

    #validate;

    constructor ( app, config ) {
        super();

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

    get frontend () {
        return this.#frontend;
    }

    // components
    get validate () {
        return this.#validate;
    }

    // public
    async init () {
        var res;

        // create components
        this.#validate = new Validate( this );

        // init components
        res = await this.#validate.init();
        if ( !res.ok ) return res;

        // frontend
        this.#frontend = new Frontend( this );
        res = await this.#frontend.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async run () {
        return result( 200 );
    }

    async authenticate ( token ) {
        return new Auth( this );
    }
}
