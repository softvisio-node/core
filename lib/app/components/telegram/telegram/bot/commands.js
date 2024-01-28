import glob from "#lib/glob";
import Command from "./command.js";

export default class {
    #bot;
    #commands = {};
    #locations = {};

    constructor ( bot ) {
        this.#bot = bot;
    }

    // public
    async init () {
        const files = glob( "**/*.js", {
            "cwd": this.#bot.component.location + "/telegram/commands",
        } );

        for ( const file of files ) {
            const module = await import( this.#bot.component.location + "/telegram/commands/" + file );

            const commandClass = module.default( Command );

            const location = file.replace( ".js", "" );

            const commandInstance = new commandClass( this.#bot, location );

            if ( this.#commands[ commandInstance.id ] ) {
                return result( [ 500, `Telegram bot command ${ commandInstance.id } is not unique` ] );
            }

            this.#commands[ commandInstance.id ] = commandInstance;

            this.#locations[ location ] = commandInstance;
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

    getByLocation ( location ) {
        return this.#locations[ location ];
    }

    *[ Symbol.iterator ] () {
        for ( const command of Object.values( this.#commands ) ) {
            yield command;
        }
    }
}
