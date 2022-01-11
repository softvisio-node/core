import Resources from "#lib/resources";
import fs from "fs";

// XXX
const resources = {
    "userAgent": `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.137 Safari/537.36`,
};

export default class Http extends Resources.Resource {

    // properties
    get id () {
        return "http";
    }

    get files () {
        return ["http.json"];
    }

    // public
    async getEtag () {
        const hash = this._getHash().update( JSON.stringify( resources ) );

        return result( 200, hash );
    }

    async build ( location ) {
        fs.writeFileSync( location + "/" + this.files[0], JSON.stringify( resources ) );

        return result( 200 );
    }
}
