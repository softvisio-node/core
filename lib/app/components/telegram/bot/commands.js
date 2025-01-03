import { globSync } from "#lib/glob";
import Command from "./command.js";

export default class {
    #bot;
    #commands = {};
    #locations = {};
    #startCallbacks = {};

    constructor ( bot ) {
        this.#bot = bot;
    }

    // public
    async init () {
        const files = globSync( "**/*.js", {
            "cwd": this.#bot.component.location + "/bot/commands",
        } );

        for ( const file of files ) {
            const module = await import( this.#bot.component.location + "/bot/commands/" + file );

            const commandClass = module.default( Command );

            const location = file.replace( ".js", "" );

            const commandInstance = new commandClass( this.#bot, location );

            if ( this.#commands[ commandInstance.id ] ) {
                return result( [ 500, `Telegram bot command ${ commandInstance.id } is not unique` ] );
            }

            const res = await commandInstance.init();

            if ( !res.ok ) return res;

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

    [ Symbol.iterator ] () {
        return Object.values( this.#commands ).values();
    }

    registerStartCallback ( id, method ) {
        if ( this.#startCallbacks[ id ] ) {
            return result( [ 400, `Start callback "${ id }" already registered` ] );
        }

        this.#startCallbacks[ id ] = method;

        return result( 200 );
    }

    getStartCallback ( id ) {
        return this.#startCallbacks[ id ];
    }

    dropPermissionsCache () {
        for ( const command of this ) {
            command.dropPermissionsCache();
        }
    }
}
