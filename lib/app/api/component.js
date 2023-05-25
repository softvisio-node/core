export default class {
    #api;
    #isShuttingDown = false;
    #isEnabled;

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

    get isEnabled () {
        if ( this.#isEnabled == null ) {
            this.#isEnabled = !!this._isEnabled();
        }

        return this.#isEnabled;
    }

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    // public
    _isEnabled () {
        return true;
    }

    async init ( ...args ) {
        return this._init( ...args );
    }

    async postInit () {
        return this._postInit();
    }

    async run () {
        return this._run();
    }

    async shutDown () {
        this.#isShuttingDown = true;

        return this._shutDown();
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

    async _shutDown () {}
}
