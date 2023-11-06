import { readConfig } from "#lib/config";

export default class Templates {
    #app;
    #templates = {};

    constructor ( app ) {
        this.#app = app;
    }

    // public
    get ( id ) {
        return this.#templates[id];
    }

    add ( templates ) {
        for ( const id in templates ) {
            this.#templates[id] = this.#app.locale.l10nt( templates[id] );
        }
    }

    addFromFile ( path ) {
        const templates = readConfig( path );

        return this.add( templates );
    }
}
