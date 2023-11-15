import path from "node:path";
import LocaleTranslation from "#lib/locale/translation";

export default class {
    #bot;
    #id;

    constructor ( bot, id ) {
        this.#bot = bot;
        this.#id = id;
    }

    // properties
    get app () {
        return this.#bot.app;
    }

    get bot () {
        return this.#bot;
    }

    get telegram () {
        return this.#bot.telegram;
    }

    get dbh () {
        return this.#bot.app.dbh;
    }

    get locale () {
        return this.#bot.locale;
    }

    get id () {
        return this.#id;
    }

    // public
    async run ( ctx, req ) {}

    l10nt ( ...args ) {
        return this.app.locale.l10nt( ...args );
    }

    // protected
    _createActionText ( text ) {
        return this.l10nt( locale => this.bot.config.telegram.actionPrefix + " " + LocaleTranslation.toString( text, { locale } ) );
    }

    _createCallbackData ( method, ...args ) {
        if ( !method.startsWith( "/" ) ) method = path.posix.join( this.id, method );

        return this.telegram.encodeCallback( method, args );
    }
}
