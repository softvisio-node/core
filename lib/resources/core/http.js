import Resources from "#lib/resources";
import * as config from "#lib/config";

const resources = config.readConfig( "#resources/http.yaml", { "resolve": import.meta.url } );

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
        config.writeConfig( location + "/" + this.files[0], resources );

        return result( 200 );
    }
}
