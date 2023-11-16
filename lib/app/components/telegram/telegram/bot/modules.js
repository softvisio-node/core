import glob from "#lib/glob";
import Module from "./module.js";

export default class {
    #bot;
    #modules = {};

    constructor ( bot ) {
        this.#bot = bot;
    }

    // public
    async init () {
        const files = glob( "**/*.js", {
            "cwd": this.#bot.component.location + "/telegram/modules",
        } );

        for ( const file of files ) {
            const id = "/" + file.replace( ".js", "" );

            const module = await import( this.#bot.component.location + "/telegram/modules/" + file );

            const ModuleClass = module.default( Module );

            this.#modules[id] = new ModuleClass( this.#bot, id );
        }

        return result( 200 );
    }

    jas ( module ) {
        return !!this.#modules[module];
    }

    get ( module ) {
        return this.#modules[module];
    }
}
