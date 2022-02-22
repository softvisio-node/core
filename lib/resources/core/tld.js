import Resources from "#lib/resources";
import fetch from "#lib/fetch";
import fs from "fs";

const URL = "https://data.iana.org/TLD/tlds-alpha-by-domain.txt";

export default class TLD extends Resources.Resource {

    // properties
    get id () {
        return "tld";
    }

    get files () {
        return ["tld.txt"];
    }

    // public
    async getEtag () {
        const res = await fetch( URL );

        if ( !res.ok ) return res;

        var data = await res.text();

        // remove first comment line
        data = data.replace( /^#.+\n/, "" );

        return result( 200, this._getHash().update( data ) );
    }

    async build ( location ) {
        const res = await fetch( URL );

        if ( !res.ok ) return res;

        fs.writeFileSync( location + "/" + this.files[0], await res.text() );

        return result( 200 );
    }
}
