import fs from "node:fs";
import { domainToUnicode } from "node:url";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";

const EPOCH = 1,
    URL = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

export default class TLD extends ExternalRecourceBuilder {
    #data;

    // properties
    get id () {
        return "c0rejs/core/resources/tld";
    }

    // protected
    async _getEtag () {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        // remove first comment line, which contains current date
        const data = EPOCH + "/" + this.#data.replace( /^#.+\n/, "" );

        return result( 200, data );
    }

    async _build ( location ) {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        const data = [];

        for ( let tld of this.#data.split( "\n" ) ) {
            tld = tld.trim();

            if ( !tld || tld.startsWith( "#" ) ) continue;

            tld = domainToUnicode( tld.toLowerCase() );

            data.push( tld );
        }

        fs.writeFileSync( location + "/tld.json", JSON.stringify( data.sort(), null, 4 ) + "\n" );

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
