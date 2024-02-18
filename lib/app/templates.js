import { readConfig } from "#lib/config";
import LocateTranslation from "#lib/locale/translation";

export default class Templates {
    #app;
    #templates = {};

    constructor ( app ) {
        this.#app = app;
    }

    // public
    get ( id ) {
        return this.#templates[ id ];
    }

    add ( templates ) {
        for ( const id in templates ) {
            if ( templates[ id ] instanceof LocateTranslation ) {
                this.#templates[ id ] = templates[ id ].clone( {
                    "locale": this.#app.locale,
                } );
            }
            else {
                this.#templates[ id ] = global.l10nt( templates[ id ] );
            }
        }
    }

    addFromFile ( path ) {
        const templates = readConfig( path );

        return this.add( templates );
    }
}
