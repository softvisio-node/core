import path from "node:path";
import * as unicode from "#lib/unicode";
import Translation from "#lib/locale/translation";
import crypto from "node:crypto";

export default class {
    #bot;
    #id;
    #menuButton;
    #menuButtonHash;
    #commands;
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

    get menuButton () {
        return null;
    }

    get commands () {
        return null;
    }

    // public
    async beforeRun ( ctx, req ) {

        // set menu button
        await this.#setMenuButton( ctx, this.menuButton );

        // set commads
        await this.#setCommands( ctx, this.commands );
    }

    async run ( ctx, req ) {}

    async beforeExit ( ctx ) {}

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

    // private
    async #setMenuButton ( ctx, menuButton ) {
        if ( !this.#menuButtonHash ) {
            if ( menuButton === "commands" ) {
                this.#menuButton = {
                    "type": "commands",
                };
            }
            else if ( menuButton?.url ) {
                this.#menuButton = {
                    "type": "web_app",
                    "text": menuButton.text || undefined,
                    "web_app": {
                        "url": menuButton.url,
                    },
                };
            }
            else {
                this.#menuButton = {
                    "type": "default",
                };
            }

            this.#menuButtonHash = this.#getHash( this.#menuButton );
        }

        if ( this.#menuButtonHash !== ctx.user.state.menuButtonHash || ctx.user.locale !== ctx.user.state.menuButtonLocale ) {
            const res = await ctx.user.send( "setChatMenuButton", {
                "menu_button": this.#menuButton,
            } );

            if ( !res.ok ) return;

            await ctx.user.updateState( {
                "menuButtonHash": this.#menuButtonHash,
                "menuButtonLocale": ctx.user.locale,
            } );
        }
    }

    async #setCommands ( ctx, commands ) {
        if ( !this.#commandsHash ) {
            if ( commands ) {
                this.#commands = Object.entries( commands ).map( ( [command, description] ) => {
                    return {
                        command,
                        description,
                    };
                } );
            }
            else {
                this.#commands = null;
            }

            this.#commandsHash = this.#getHash( this.#commands );
        }

        if ( this.#commands == null ) return;

        if ( this.#commandsHash !== ctx.user.state.commandsHash || ctx.user.locale !== ctx.user.state.commandsLocale ) {
            const res = await ctx.user.setChatCommands( this.#commands );

            if ( !res.ok ) return;

            await ctx.user.updateState( {
                "commandsHash": this.#commandsHash,
                "commandsLocale": ctx.user.locale,
            } );
        }
    }

    #getHash ( data ) {
        return crypto.createHash( "MD5" ).update( JSON.stringify( data ) ).digest( "base64url" );
    }
}
