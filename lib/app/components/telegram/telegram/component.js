import TelegramBot from "./bot.js";

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

    get Bot () {
        return TelegramBot;
    }

    // public
    async init () {
        return this._init();
    }

    async run () {
        return this._run();
    }

    async createBot ( dbh, id, options ) {
        return this._createBot( dbh, id, options );
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _run () {
        return result( 200 );
    }

    async _createBot ( dbh, id, options ) {
        return result( 200 );
    }
}
