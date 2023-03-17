export default class Storage {
    #app;
    #config;

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

    // public
    async init () {
        var res;

        res = await this._init();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async run () {
        var res;

        res = await this._run();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _run () {
        return result( 200 );
    }
}
