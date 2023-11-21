import path from "node:path";
import * as unicode from "#lib/unicode";
import Translation from "#lib/locale/translation";
import crypto from "node:crypto";

export default class {
    #bot;
    #id;
    #commandsHash;

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

    get commands () {
        return null;
    }

    // public
    async beforeRun ( ctx, req ) {

        // set commads
        await this._setCommands( ctx );
    }

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

    // protected
    async _setCommands ( ctx ) {
        if ( !this.#commandsHash ) {
            const commands = JSON.stringify( this.commands );

            this.#commandsHash = crypto.createHash( "MD5" ).update( commands ).digest( "base64url" );
        }

        if ( this.commands == null ) return;

        if ( this.#commandsHash !== ctx.user.state.commandsHash || ctx.user.locale !== ctx.user.state.commandsLocale ) {
            await ctx.user.setChatCommands( this.commands );

            await ctx.user.updateState( {
                "commandsHash": this.#commandsHash,
                "commandsLocale": ctx.user.locale,
            } );
        }
    }
}
