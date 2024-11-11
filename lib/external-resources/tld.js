import fs from "node:fs";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";

const URL = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

export default class TLD extends ExternalRecourceBuilder {
    #data;

    // properties
    get id () {
        return "softvisio-node/core/resources/tld";
    }

    // protected
    async _getEtag () {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        // remove first comment line, which contains current date
        const data = this.#data.replace( /^#.+\n/, "" );

        return result( 200, data );
    }

    async _build ( location ) {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        fs.writeFileSync( location + "/tld.txt", this.#data );

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
