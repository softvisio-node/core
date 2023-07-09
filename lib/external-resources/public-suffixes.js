import Builder from "#lib/external-resources/builder";
import fetch from "#lib/fetch";
import fs from "fs";

const URL = "https://publicsuffix.org/list/public_suffix_list.dat";

export default class PublicSuffix extends Builder {

    // properties
    get id () {
        return "softvisio-node/core/data/public-suffixes";
    }

    // proteted
    async _getEtag () {
        const res = await fetch( URL );

        if ( !res.ok ) return res;

        const data = await res.buffer();

        return result( 200, this._getHash().update( data ) );
    }

    async _build ( location ) {
        const res = await fetch( URL );

        if ( !res.ok ) return res;

        fs.writeFileSync( location + "/public-suffixes.txt", await res.text() );

        return result( 200 );
    }
}
