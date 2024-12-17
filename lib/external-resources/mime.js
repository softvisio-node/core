import fs from "node:fs";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";
import Mime from "#lib/mime/mime";

const EPOCH = 1,
    URL = "https://raw.githubusercontent.com/jshttp/mime-db/master/db.json";

export default class MimeBuilder extends ExternalRecourceBuilder {
    #data;

    // properties
    get id () {
        return "softvisio-node/core/resources/mime";
    }

    // protected
    async _getEtag () {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        const data = EPOCH + "/" + this.#data;

        return result( 200, data );
    }

    async _build ( location ) {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        fs.writeFileSync( location + "/mime.json", this.#data + "\n" );

        return result( 200 );
    }

    // private
    async #getData () {
        if ( !this.#data ) {
            const res = await fetch( URL );
            if ( !res.ok ) return res;

            const mime = new Mime();

            const types = await res.json();

            for ( const type in types ) {
                mime.add( {
                    type,
                    "compressible": types[ type ].compressible,
                    "charset": types[ type ].charset,
                } );

                if ( types[ type ].extensions ) {
                    for ( const extname of types[ type ].extensions ) {
                        if ( types[ type ].source === "iana" || !mime.extnames.has( extname ) ) {
                            mime.extnames.add( type, extname );
                        }
                    }
                }
            }

            this.#data = JSON.stringify( mime, null, 4 );
        }

        return result( 200 );
    }
}
