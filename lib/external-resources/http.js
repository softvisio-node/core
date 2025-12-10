import * as config from "#lib/config";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import UserAgent from "#lib/user-agent";

const API_URL = "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json";

export default class Http extends ExternalRecourceBuilder {
    #majorVersion;
    #data;

    // properties
    get id () {
        return "c0rejs/core/resources/http";
    }

    // protected
    async _getEtag () {
        const res = await this.#build();
        if ( !res.ok ) return res;

        return result( 200, JSON.stringify( this.#data ) );
    }

    async _build ( location ) {
        await config.writeConfig( location + "/browsers.json", this.#data, { "readable": true } );

        return result( 200 );
    }

    async _getMeta () {
        return result( 200, {
            "chromeVersion": this.#majorVersion,
        } );
    }

    // private
    async #build () {
        if ( this.#majorVersion ) return result( 200 );

        const res = await fetch( API_URL );
        if ( !res.ok ) return res;

        this.#majorVersion = ( await res.json() ).channels[ "Stable" ].version.match( /^(\d+)/ )[ 1 ];

        const data = {};

        for ( const brand in UserAgent.chromiumBrands ) {
            for ( const platform of Object.values( UserAgent.platforms ) ) {
                if ( !platform.chromium ) continue;

                data[ brand + "-" + platform.id ] = {
                    "userAgent": UserAgent.createChromiumUserAgentString( brand, platform.id, this.#majorVersion ),
                    "http:": {
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                    "https:": {
                        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                        "Accept-Language": "en-US,en;q=0.9",

                        "Sec-CH-UA": UserAgent.createChromiumBrands( brand, this.#majorVersion, false )
                            .map( ( { brand, version } ) => `"${ brand }";v="${ version }"` )
                            .join( ", " ),

                        "Sec-CH-UA-Mobile": platform.mobile
                            ? "?1"
                            : "?0",

                        "Sec-CH-UA-Platform": `"${ platform[ "sec-ch-ua-platform" ] }"`,
                        "Sec-Fetch-Dest": "document",
                        "Sec-Fetch-Mode": "navigate",
                        "Sec-Fetch-Site": "none",
                        "Sec-Fetch-User": "?1",
                    },
                };
            }
        }

        this.#data = data;

        return result( 200 );
    }
}
