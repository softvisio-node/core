export default class {
    #api;
    #isShuttingDown = false;

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
        return this.#isShuttingDown;
    }

    // public
    async configure () {
        return this._configure();
    }

    async init () {
        return this._init();
    }

    async afterInit () {
        return this._afterInit();
    }

    async start () {
        return this._start();
    }

    async shutDown () {
        this.#isShuttingDown = true;

        return this._shutDown();
    }

    // protected
    async _configure () {
        return result( 200 );
    }

    async _init () {
        return result( 200 );
    }

    async _afterInit () {
        return result( 200 );
    }

    async _start () {
        return result( 200 );
    }

    async _shutDown () {}
}
