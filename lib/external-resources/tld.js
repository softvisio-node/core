import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";
import fs from "fs";

const URL = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

export default class TLD extends ExternalRecourceBuilder {

    // properties
    get id () {
        return "softvisio-node/core/resources/tld";
    }

    // protected
    async _getEtag () {
        const res = await fetch( URL );

        if ( !res.ok ) return res;

        var data = await res.text();

        // remove first comment line
        data = data.replace( /^#.+\n/, "" );

        return result( 200, this._getHash().update( data ) );
    }

    async _build ( location ) {
        const res = await fetch( URL );

        if ( !res.ok ) return res;

        fs.writeFileSync( location + "/tld.txt", await res.text() );

        return result( 200 );
    }
}
