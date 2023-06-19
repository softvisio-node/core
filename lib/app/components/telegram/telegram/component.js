import TelegramBot from "./bot.js";
import Locale from "#lib/locale";

export default class {
    #app;
    #config;
    #dbh;
    #locales = new Map();

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
        const locales = new Set( this.config.locales );

        // build list of allowed locales
        for ( let locale of this.app.locales.locales ) {
            if ( locales.size && !locales.has( locale ) ) continue;

            locale = new Locale( locale );

            this.#locales.set( locale.id, locale.name );
        }

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
