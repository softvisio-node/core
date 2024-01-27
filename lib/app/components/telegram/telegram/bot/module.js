import path from "node:path";
import Translation from "#lib/locale/translation";
import crypto from "node:crypto";

export default class {
    #bot;
    #id;
    #isCommand;
    #command;
    #menuButton = {};
    #commands = {};

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

    get id () {
        return this.#id;
    }

    get isCommand () {
        this.#isCommand ??= !this.id.includes( "/" );

        return this.#isCommand;
    }

    get commang () {
        if ( this.#command === undefined ) {
            if ( this.isCommand ) {
                this.#command = this.id.replaceAll( "-", "_" );
            }
            else {
                this.#command = null;
            }
        }

        return this.#command;
    }

    // public
    getTitle ( ctx ) {
        return this.id;
    }

    getMenuButton ( ctx ) {
        return null;
    }

    getCommands ( ctx ) {
        return null;
    }

    checkPermissions ( ctx ) {
        return true;
    }

    async beforeRun ( ctx, req ) {

        // set menu button
        await this.#setMenuButton( ctx );

        // set commads
        await this.#setCommands( ctx );
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

    createStartUrl ( linkToken, method, ...args ) {
        const url = new URL( "https://t.me/" + this.#bot.username );

        const data = [];

        if ( linkToken ) {
            const linkTokenBuf = Buffer.allocUnsafe( 8 );

            linkTokenBuf.writeBigInt64BE( BigInt( linkToken ) );

            data.push( linkTokenBuf );
        }

        if ( method ) {
            if ( !linkToken ) data.push( null );

            if ( !method.includes( "/" ) ) method = path.posix.join( this.id, method );

            data.push( method );

            if ( args.length ) data.push( ...args );
        }

        if ( data.length ) {
            url.searchParams.set( "start", this.bot.telegram.encodeCallbackData( ...data ) );
        }

        return url.href;
    }

    createBackButtonText ( text ) {
        return this.l10nt( locale => "<- " + Translation.toString( text, { locale } ) );
    }

    createForwardButtonText ( text ) {
        return this.l10nt( locale => Translation.toString( text, { locale } ) + " ->" );
    }

    // XXX
    async sendCommandsList ( ctx, commands ) {
        commands ??= this.getCommands( ctx );
    }

    async API_run ( ctx, module ) {
        return ctx.run( module );
    }

    // private
    async #setMenuButton ( ctx, menuButton ) {
        menuButton = this.#getMenuButton( ctx, menuButton );

        if ( menuButton.data == null ) return;

        const id = `${ ctx.user.locale }/${ ctx.permissions.hash }/${ menuButton.hash }`;

        if ( id !== ctx.user.state.menuButton ) {
            const res = await ctx.user.send( "setChatMenuButton", {
                "menu_button": menuButton.data,
            } );

            if ( !res.ok ) return;

            await ctx.user.updateState( {
                "menuButton": id,
            } );
        }
    }

    async #setCommands ( ctx, commands ) {
        commands = this.#getCommands( ctx, commands );

        // inherit commands
        if ( commands.data == null ) return;

        const id = `${ ctx.user.locale }/${ ctx.permissions.hash }/${ commands.hash }`;

        if ( id !== ctx.user.state.commands ) {
            const res = await ctx.user.setChatCommands( commands.data );

            if ( !res.ok ) return;

            await ctx.user.updateState( {
                "commands": id,
            } );
        }
    }

    #getMenuButton ( ctx, menuButton ) {
        if ( !this.#menuButton[ ctx.permissions.hash ] ) {
            menuButton ??= this.getMenuButton( ctx );

            const data = {
                "data": null,
                "hash": null,
            };

            if ( menuButton == null ) {
                data.data = null;
            }
            else if ( menuButton === "commands" ) {
                data.data = {
                    "type": "commands",
                };
            }
            else if ( menuButton?.url ) {
                data.data = {
                    "type": "web_app",
                    "text": menuButton.text || undefined,
                    "web_app": {
                        "url": menuButton.url,
                    },
                };
            }
            else {
                data.data = {
                    "type": "default",
                };
            }

            data.hash = this.#getHash( data.data );

            this.#menuButton[ ctx.permissions.hash ] = data;
        }

        return this.#menuButton[ ctx.permissions.hash ];
    }

    // XXX
    #getCommands ( ctx, commands ) {
        if ( !this.#commands[ ctx.permissions.hash ] ) {
            commands ??= this.getCommands( ctx );

            const data = {
                "data": null,
                "hash": null,
            };

            // inherit
            if ( commands == null ) {
                data.data = null;
            }

            // no commands
            else if ( commands === false ) {
                data.data = false;
            }
            else {
                data.data = [];

                for ( const group of commands ) {
                    let groupCommands;

                    if ( typeof group === "object" ) {
                        groupCommands = group.commands;
                    }
                    else {
                        groupCommands = [ group ];
                    }

                    if ( !groupCommands?.length ) continue;

                    for ( const command of groupCommands ) {
                        const module = this.bot.modules.get( command );

                        if ( !module?.isCommand ) {
                            console.warn( `Telegram command is not valid: ${ command }` );
                        }
                        else if ( module.checkPermissions( ctx ) ) {
                            data.data.push( {
                                "command": module.command,
                                "description": module.getTitle( ctx ),
                            } );
                        }
                    }
                }

                if ( !data.data.length ) data.data = false;
            }

            data.hash = this.#getHash( data.data );

            this.#commands[ ctx.permissions.hash ] = data;
        }

        return this.#commands[ ctx.permissions.hash ];
    }

    #getHash ( data ) {
        return crypto.createHash( "MD5" ).update( JSON.stringify( data ) ).digest( "base64url" );
    }
}
