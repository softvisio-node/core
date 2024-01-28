import glob from "#lib/glob";
import Command from "./command.js";

export default class {
    #bot;
    #commands = {};

    constructor ( bot ) {
        this.#bot = bot;
    }

    // public
    async init () {
        const files = glob( "**/*.js", {
            "cwd": this.#bot.component.location + "/telegram/commands",
        } );

        for ( const file of files ) {
            const id = file.replace( ".js", "" ).replaceAll( "-", "_" );

            const module = await import( this.#bot.component.location + "/telegram/commands/" + file );

            const commandClass = module.default( Command );

            // XXX
            const parentCommand = "";

            const commandInstance = new commandClass( this.#bot, id, parentCommand );

            if ( this.#commands[ commandInstance.id ] ) {
                return result( [ 500, `Telegram bot command ${ commandInstance.id } is not unique` ] );
            }

            this.#commands[ commandInstance.id ] = commandInstance;
        }

        if ( !this.has( "start" ) ) return result( [ 500, `Start command is requires` ] );

        return result( 200 );
    }

    has ( command ) {
        return !!this.#commands[ command ];
    }

    get ( command ) {
        return this.#commands[ command ];
    }
}
