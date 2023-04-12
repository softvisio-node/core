export default class {
    #app;
    #config;
    #dbh;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
        this.#dbh = app.dbh;
    }

    // public
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dbh () {
        return this.#dbh;
    }

    // public
    async init () {
        return this._init();
    }

    async run () {
        return this._run();
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _run () {
        return result( 200 );
    }
}
