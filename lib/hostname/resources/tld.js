import Resources from "#lib/resources";
import fetch from "#lib/fetch";
import fs from "fs";

export default class TLD extends Resources.Resource {
    #url = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

    // properties
    get id () {
        return "tld";
    }

    get files () {
        return ["tlds-alpha-by-domain.txt"];
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
