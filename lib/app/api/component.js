export default class {
    #api;

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
        return this.#api.dbh;
    }

    get isShuttingDown () {
        return this.#api.isShuttingDown;
    }

    // public
    async init () {
        return this._init();
    }

    async postInit () {
        return this._postInit();
    }

    async run () {
        return this._run();
    }

    async stop () {
        return this._stop();
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _postInit () {
        return result( 200 );
    }

    async _run () {
        return result( 200 );
    }

    async _stop () {}
}
