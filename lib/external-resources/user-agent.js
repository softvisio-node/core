import fs from "node:fs";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";
import * as yaml from "#lib/yaml";

const URL = "https://raw.githubusercontent.com/ua-parser/uap-core/master/regexes.yaml";

export default class extends ExternalRecourceBuilder {
    #data;

    // properties
    get id () {
        return "softvisio-node/core/resources/user-agent";
    }

    // proteted
    async _getEtag () {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        return result( 200, this.#data );
    }

    async _build ( location ) {
        const res = await this.#getData();
        if ( !res.ok ) return res;

        const data = yaml.fromYaml( this.#data ),
            json = {
                "browser": [],
                "os": [],
                "device": [],
            },
            properties = {
                "user_agent_parsers": [ "browser", "family_replacement", "v1_replacement", "v2_replacement", "v3_replacement" ],
                "os_parsers": [ "os", "os_replacement", "os_v1_replacement", "os_v2_replacement", "os_v3_replacement", "os_v4_replacement" ],
                "device_parsers": [ "device", "device_replacement", "brand_replacement", "model_replacement" ],
            };

        for ( const name in data ) {
            for ( const row of data[ name ] ) {
                const record = {};

                json[ properties[ name ][ 0 ] ].push( record );

                if ( row.regex_flag ) {
                    record[ 0 ] = [ row.regex, row.regex_flag ];
                }
                else {
                    record[ 0 ] = row.regex;
                }

                for ( let n = 1; n < properties[ name ].length; n++ ) {
                    const property = properties[ name ][ n ];

                    if ( row[ property ] ) {
                        record[ n ] = row[ property ];
                    }
                }
            }
        }

        fs.writeFileSync( location + "/regexes.json", JSON.stringify( json, null, 4 ) + "\n" );

        return result( 200 );
    }

    // private
    async #getData () {
        if ( !this.#data ) {
            const res = await fetch( URL );
            if ( !res.ok ) return res;

            this.#data = await res.text();
        }

        return result( 200 );
    }
}
