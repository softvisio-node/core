import Resources from "#lib/resources";
import fetch from "#lib/fetch";
import fs from "fs";

const URL = "https://publicsuffix.org/list/public_suffix_list.dat";

export default class PublicSuffix extends Resources.Resource {

    // properties
    get id () {
        return "public-suffix";
    }

    get files () {
        return ["public-suffix.txt"];
    }

    // public
    async getEtag () {
        const res = await fetch( URL );

        if ( !res.ok ) return res;

        const data = await res.buffer();

        return result( 200, this._getHash().update( data ) );
    }

    async build ( location ) {
        const res = await fetch( URL );

        if ( !res.ok ) return res;

        fs.writeFileSync( location + "/" + this.files[0], await res.text() );

        return result( 200 );
    }
}
