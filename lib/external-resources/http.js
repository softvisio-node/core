import * as config from "#lib/config";
import ExternalRecourceBuilder from "#lib/external-resource-builder";

const resources = await ( await fetch( "https://raw.githubusercontent.com/softvisio-node/core/main/resources/external-resources-sources/http.json" ) ).json();

export default class Http extends ExternalRecourceBuilder {

    // properties
    get id () {
        return "softvisio-node/core/resources/http";
    }

    // protected
    async _getEtag ( { etag, buildDate, meta } ) {
        return result( 200, JSON.stringify( resources ) );
    }

    async _build ( location ) {
        config.writeConfig( location + "/http.json", resources, { "readable": true } );

        return result( 200 );
    }
}
