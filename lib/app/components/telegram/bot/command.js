import LocaleTemplate from "#lib/locale/template";
import crypto from "node:crypto";
import path from "node:path";

export default class {
    #bot;
    #id;
    #location;
    #parentCommand;
    #menuButton = {};
    #commands = {};
    #childCommands;
    #commandsList = {};

    constructor ( bot, location ) {
        this.#bot = bot;

        this.#location = location;
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
        this.#id ??= path.basename( this.#location ).replaceAll( "-", "_" );

        return this.#id;
    }

    get parentCommand () {
        if ( this.#parentCommand === undefined ) {
            if ( this.id === "start" ) {
                this.#parentCommand = null;
            }
            else {
                let dirname = path.dirname( this.#location );

                if ( dirname === "." ) {
                    this.#parentCommand = this.#bot.commands.get( "start" );
                }
                else {
                    while ( true ) {
                        this.#parentCommand = this.#bot.commands.getByLocation( dirname );

                        if ( this.#parentCommand ) break;

                        dirname = path.dirnam( dirname );

                        if ( dirname === "." ) break;
                    }

                    this.#parentCommand ||= this.#bot.commands.get( "start" );
                }
            }
        }

        return this.#parentCommand;
    }

    get childCommands () {
        if ( this.#childCommands === undefined ) {
            this.#childCommands = null;

            for ( const command of this.#bot.commands ) {
                if ( command.parentCommand === this ) {
                    this.#childCommands ??= [];

                    this.#childCommands.push( command );
                }

                if ( this.#childCommands ) {
                    this.#childCommands = this.#childCommands.sort( ( a, b ) => a.commandOrder - b.commandOrder );
                }
            }
        }

        return this.#childCommands;
    }

    get commandOrder () {
        return 0;
    }

    // public
    async init () {
        return this._init();
    }

    getDescription ( ctx ) {
        return this.id.replaceAll( "_", " " );
    }

    getGroupDescription ( ctx ) {}

    getMenuButton ( ctx ) {
        return null;
    }

    isEnabled ( ctx ) {
        return true;
    }

    isChildCommandsEnabled ( ctx ) {
        for ( const command of this.childCommands ) {
            if ( command.isEnabled( ctx ) ) return true;
        }

        return false;
    }

    async beforeRun ( ctx, requestMessage ) {

        // set menu button
        await this.#setMenuButton( ctx );

        // set commads
        await this.#setCommands( ctx );
    }

    async run ( ctx, requestMessage ) {}

    async beforeExit ( ctx ) {}

    encodeCallbackData ( method, ...args ) {
        if ( !method.includes( "/" ) ) method = this.id + "/" + method;

        return this.bot.telegram.encodeCallbackData( method, ...args );
    }

    createStartUrl ( method, ...args ) {
        const url = new URL( "https://t.me/" + this.#bot.username );

        url.searchParams.set( "start", [ method, ...args ].join( "-" ) );

        return url.href;
    }

    async sendCommandsList ( ctx, { level } = {} ) {
        const commandsList = this.#getCommandsList( ctx, level );

        if ( !commandsList ) return result( 200 );

        return ctx.user.send( "sendMessage", {
            "text": commandsList,
            "parse_mode": "HTML",
        } );
    }

    async API_run ( ctx, command ) {
        return ctx.run( command );
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _registerStartCallback ( id, method ) {
        this.bot.commands.registerStartCallback( id, this.id + "/" + method );
    }

    // private
    async #setMenuButton ( ctx ) {
        const menuButton = this.#getMenuButton( ctx );

        if ( menuButton.data == null ) return;

        const id = `${ ctx.user.locale }/${ ctx.permissions.hash }/${ menuButton.hash }`;

        if ( id !== ctx.user.state.menuButtonId ) {
            const res = await ctx.user.send( "setChatMenuButton", {
                "menu_button": menuButton.data,
            } );

            if ( !res.ok ) return;

            await ctx.user.updateState( {
                "menuButtonId": id,
            } );
        }
    }

    async #setCommands ( ctx ) {
        const commands = this.#getCommands( ctx );

        const id = `${ ctx.user.locale }/${ ctx.permissions.hash }/${ commands.hash }`;

        if ( id !== ctx.user.state.commandsId ) {
            const res = await ctx.user.setChatCommands( commands.data );

            if ( !res.ok ) return;

            await ctx.user.updateState( {
                "commandsId": id,
            } );
        }
    }

    #getMenuButton ( ctx ) {
        const id = `${ ctx.user.locale }/${ ctx.permissions.hash }`;

        if ( !this.#menuButton[ id ] ) {
            const menuButton = this.getMenuButton( ctx );

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

            this.#menuButton[ id ] = data;
        }

        return this.#menuButton[ id ];
    }

    #getCommands ( ctx ) {
        const id = `${ ctx.user.locale }/${ ctx.permissions.hash }`;

        if ( !this.#commands[ id ] ) {
            const data = {
                "data": null,
                "hash": null,
            };

            var commands = this.childCommands,
                parentCommand = this.parentCommand;

            if ( !commands ) {
                commands = parentCommand?.childCommands;

                parentCommand = parentCommand?.parentCommand;
            }

            // inherit
            if ( !commands ) {
                data.data = null;
            }
            else {
                data.data = [];

                const addedCommands = new Set();

                for ( const commandInstance of commands ) {
                    if ( !ctx.isCommandEnabled( commandInstance ) ) continue;

                    addedCommands.add( commandInstance.id );

                    data.data.push( {
                        "command": commandInstance.id,
                        "description": this.#translate( ctx, commandInstance.getDescription( ctx ) ),
                    } );
                }

                // add parent command
                if ( parentCommand && !addedCommands.has( parentCommand.id ) ) {
                    if ( ctx.isCommandEnabled( parentCommand ) ) {
                        addedCommands.add( parentCommand.id );

                        data.data.unshift( {
                            "command": parentCommand.id,
                            "description": this.#translate( ctx, parentCommand.getDescription( ctx ) ),
                        } );
                    }
                }

                // add start command
                if ( !addedCommands.has( "staer" ) ) {
                    const commandInstance = this.#bot.commands.get( "start" );

                    addedCommands.add( commandInstance.id );

                    data.data.unshift( {
                        "command": commandInstance.id,
                        "description": this.#translate( ctx, commandInstance.getDescription( ctx ) ),
                    } );
                }

                if ( !data.data.length ) data.data = null;
            }

            data.hash = this.#getHash( data.data );

            this.#commands[ id ] = data;
        }

        return this.#commands[ id ];
    }

    #getHash ( data ) {
        return crypto.createHash( "MD5" ).update( JSON.stringify( data ) ).digest( "base64url" );
    }

    #getCommandsList ( ctx, level ) {
        if ( !this.childCommands ) return;

        level ||= 1;
        if ( level !== 1 ) level = 2;

        const id = `${ ctx.user.locale }/${ ctx.permissions.hash }/${ level }`;

        if ( this.#commandsList[ id ] === undefined ) {
            const commands = [];

            // level 1
            if ( level === 1 ) {
                for ( const commandInstance of this.childCommands ) {
                    if ( !ctx.isCommandEnabled( commandInstance ) ) continue;

                    commands.push( `/${ commandInstance.id } - ${ this.#translate( ctx, commandInstance.getDescription( ctx ) ) }` );
                }
            }

            // level 2
            else {
                for ( const commandInstance of this.childCommands ) {

                    // commands
                    if ( commandInstance.childCommands ) continue;

                    if ( !ctx.isCommandEnabled( commandInstance ) ) continue;

                    commands.push( `/${ commandInstance.id } - ${ this.#translate( ctx, commandInstance.getDescription( ctx ) ) }` );
                }

                // groups
                for ( const commandInstance of this.childCommands ) {
                    if ( !commandInstance.childCommands ) continue;

                    if ( !ctx.isCommandEnabled( commandInstance ) ) continue;

                    const groupCommands = [];

                    for ( const groupCommand of commandInstance.childCommands ) {
                        if ( !ctx.isCommandEnabled( groupCommand ) ) continue;

                        groupCommands.push( `/${ groupCommand.id } - ${ this.#translate( ctx, groupCommand.getDescription( ctx ) ) }` );
                    }

                    // group has no commands
                    if ( !groupCommands.length ) continue;

                    commands.push( "" );

                    // group title
                    const groupDescription = commandInstance.getGroupDescription( ctx );

                    if ( groupDescription ) {
                        commands.push( "<b>" + this.#translate( ctx, groupDescription ) + "</b>" );
                    }

                    // group commands
                    commands.push( groupCommands.join( "\n" ) );
                }
            }

            if ( commands.length ) {
                commands.unshift( this.#translate( ctx, l10nt( `You can use these commands::\n` ) ) );
            }

            this.#commandsList[ id ] = commands.join( "\n" );
        }

        return this.#commandsList[ id ];
    }

    #translate ( ctx, template ) {
        return LocaleTemplate.toString( template, {
            "localeDomain": ctx.user.locale,
        } );
    }
}
