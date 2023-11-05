import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";
import fs from "fs";

const URL = "https://publicsuffix.org/list/public_suffix_list.dat";

export default class PublicSuffix extends ExternalRecourceBuilder {

    // properties
    get id () {
        return "softvisio-node/core/resources/public-suffixes";
    }

    // proteted
    async _getEtag () {
        const res = await fetch( URL );
        if ( !res.ok ) return res;

        return result( 200, await res.buffer() );
    }

    async _build ( location ) {
        const res = await fetch( URL );

        if ( !res.ok ) return res;

        fs.writeFileSync( location + "/public-suffixes.txt", await res.text() );

        return result( 200 );
    }
}
