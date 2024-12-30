export default class {
    #api;
    #isDestroying = false;

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

    get isDestroying () {
        return this.#isDestroying;
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

    async destroy () {
        this.#isDestroying = true;

        return this._destroy();
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

    async _destroy () {}
}
