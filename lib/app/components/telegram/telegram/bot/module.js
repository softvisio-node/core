import path from "node:path";
import * as unicode from "#lib/unicode";
import Translation from "#lib/locale/translation";

export default class {
    #bot;
    #id;

    constructor ( bot, id ) {
        this.#bot = bot;
        this.#id = id;
    }

    // properties
    get id () {
        return this.#id;
    }

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

    // public
    async beforeRun ( ctx, req ) {}

    async run ( ctx, req ) {}

    async beforeExit () {}

    l10nt ( ...args ) {
        return this.app.locale.l10nt( ...args );
    }

    encodeCallbackData ( method, ...args ) {
        if ( !method.includes( "/" ) ) method = path.posix.join( this.id, method );

        return this.bot.telegram.encodeCallbackData( method, ...args );
    }

    createBackButtonText ( text ) {
        return this.l10nt( locale => unicode.WIDE_HEADED_LEFTWARDS_BARB_ARROW + " " + Translation.toString( text, { locale } ) );
    }

    createForwardButtonText ( text ) {
        return this.l10nt( locale => Translation.toString( text, { locale } ) + " " + unicode.WIDE_HEADED_RIGHTWARDS_BARB_ARROW );
    }

    async API_call ( ctx, module ) {
        return ctx.call( module );
    }
}
