import ExternalRecourceBuilder from "#lib/external-resource-builder";
import * as config from "#lib/config";

const resources = config.readConfig( "#resources/external-resources-sources/http.yaml", { "resolve": import.meta.url } );

export default class Http extends ExternalRecourceBuilder {

    // properties
    get id () {
        return "softvisio-node/core/resources/http";
    }

    // protected
    async _getEtag () {
        return result( 200, JSON.stringify( resources ) );
    }

    async _build ( location ) {
        config.writeConfig( location + "/http.json", resources, { "readable": true } );

        return result( 200 );
    }
}
