import glob from "#lib/glob";
import { readConfig } from "#lib/config";
import { schemaValidator } from "#lib/app/api/schema/validator";
import Module from "#lib/app/api/schema/module";

export default class {
    #emits = new Set();
    #allowAllEvents = false;
    #modules = {};
    #methods = {};
    #logMethods;

    // properties
    get emits () {
        return this.#emits;
    }

    get allowAllEvents () {
        return this.#allowAllEvents;
    }

    get modules () {
        return this.#modules;
    }

    get methods () {
        return this.#methods;
    }

    getLogMethods () {
        if ( !this.#logMethods ) {
            this.#logMethods = {};

            for ( const id of Object.keys( this.#methods ).sort() ) {
                if ( this.#methods[id].logApiCalls ) this.#logMethods[id] = this.#methods[id];
            }
        }

        return this.#logMethods;
    }

    // public
    addSchema ( location ) {
        const files = glob.sync( "**/*.yaml", { "cwd": location, "nodir": true } );

        for ( const file of files ) {

            // index
            if ( /^v\d+\.yaml$/.test( file ) ) {
                const index = readConfig( location + "/" + file );

                if ( !schemaValidator.validate( "index", index ) ) {
                    return result( [500, `API index "${file}" is not valid, inspect errors below:\n${schemaValidator.errors}`] );
                }

                if ( index.emits ) {
                    index.emits.forEach( name => this.#addEvent( name ) );
                }
            }

            // module
            else {
                const id = file.replace( ".yaml", "" );

                this.#modules[id] ??= new Module( this, id );

                const res = this.#modules[id].addLocation( location );

                if ( !res.ok ) return res;
            }

            for ( const module of Object.values( this.#modules ) ) {
                for ( const event of module.emits ) this.#addEvent( event );

                for ( const method of Object.values( module.methods ) ) {
                    this.#methods[method.id] = method;
                }
            }
        }

        return result( 200 );
    }

    async loadApi ( api ) {
        for ( const module of Object.values( this.#modules ) ) {
            const res = await module.loadApi( api );

            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    // private
    #addEvent ( name ) {
        if ( name === "*" ) {
            this.#allowAllEvents = true;
        }
        else {
            this.#emits.add( name );
        }
    }
}
