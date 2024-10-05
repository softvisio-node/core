import * as config from "#lib/config";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import yaml from "#lib/yaml";

const resources = yaml.parse( await ( await fetch( "https://raw.githubusercontent.com/softvisio-node/core/main/resources/external-resources-sources/http.yaml" ) ).text() );

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
