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
            const id = file.replace( ".js", "" );

            const module = await import( this.#bot.component.location + "/telegram/commands/" + file );

            const ModuleClass = module.default( Command );

            this.#commands[ id ] = new ModuleClass( this.#bot, id );
        }

        if ( !this.has( "start" ) ) return result( [ 500, `Start module is requires` ] );

        return result( 200 );
    }

    has ( module ) {
        return !!this.#commands[ module ];
    }

    get ( module ) {
        return this.#commands[ module ];
    }
}
