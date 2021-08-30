import Resources from "#lib/resources";
import fetch from "#lib/fetch";
import fs from "fs";

export default class PublicSuffix extends Resources.Resource {
    #url = "https://publicsuffix.org/list/public_suffix_list.dat";

    // properties
    get id () {
        return "public-suffix";
    }

    get files () {
        return ["public_suffix_list.dat"];
    }

    // public
    async getETag () {
        return this._getLastModified( this.#url );
    }

    async build ( location ) {
        const res = await fetch( this.#url );

        if ( !res.ok ) return res;

        fs.writeFileSync( location + "/" + this.files[0], await res.text() );

        return result( 200 );
    }
}
