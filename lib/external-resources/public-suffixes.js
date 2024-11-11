import fs from "node:fs";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";

const URL = "https://publicsuffix.org/list/public_suffix_list.dat";

export default class PublicSuffix extends ExternalRecourceBuilder {
    #data;

    // properties
    get id () {
        return "softvisio-node/core/resources/public-suffixes";
    }

    // proteted
    async _getEtag () {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        return result( 200, this.#data );
    }

    async _build ( location ) {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        fs.writeFileSync( location + "/public-suffixes.txt", this.#data );

        return result( 200 );
    }

    // private
    async #getData () {
        if ( !this.#data ) {
            const res = await fetch( URL );
            if ( !res.ok ) return res;

            this.#data = await res.text();
        }

        return result( 200 );
    }
}
