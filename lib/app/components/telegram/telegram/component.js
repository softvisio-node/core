import Component from "#lib/app/component";
import TelegramBot from "./bot.js";
import Locale from "#lib/locale";

export default class extends Component {
    #dbh;
    #locales = new Map();

    // public
    get dbh () {
        return this.app.#dbh;
    }

    get Bot () {
        return TelegramBot;
    }

    get locales () {
        return this.#locales;
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

    async createBot ( dbh, id, options ) {
        return this._createBot( dbh, id, options );
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _createBot ( dbh, id, options ) {
        return result( 200 );
    }
}
