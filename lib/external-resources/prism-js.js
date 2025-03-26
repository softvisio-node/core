import fs from "node:fs";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";

const URL = "https://raw.githubusercontent.com/PrismJS/prism/master/components.json";

export default class PrismJs extends ExternalRecourceBuilder {
    #data;

    // properties
    get id () {
        return "softvisio-node/core/resources/prism-js";
    }

    // protected
    async _getEtag () {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        return result( 200, JSON.stringify( this.#data ) );
    }

    async _build ( location ) {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        fs.writeFileSync( location + "/components.json", JSON.stringify( this.#data, null, 4 ) + "\n" );

        return result( 200 );
    }

    // private
    async #getData () {
        if ( !this.#data ) {
            const res = await fetch( URL );
            if ( !res.ok ) return res;

            this.#data = await res.json();
        }

        return result( 200 );
    }
}
