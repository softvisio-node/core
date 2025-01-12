import Browser from "#lib/browser";
import * as config from "#lib/config";
import ExternalRecourceBuilder from "#lib/external-resource-builder";

const API_URL = "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json";

export default class Http extends ExternalRecourceBuilder {
    #version;

    // properties
    get id () {
        return "softvisio-node/core/resources/http";
    }

    // protected
    async _getEtag () {
        const res = await this.#getVersion();
        if ( !res.ok ) return res;

        return result( 200, JSON.stringify( this.#version ) );
    }

    async _build ( location ) {
        const data = {};

        for ( const [ platform, config ] of Object.entries( Browser.chromePlatforms ) ) {
            data[ platform ] = {
                "userAgent": Browser.buildChromeUserAgent( platform, this.#version ),
                "http:": {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "Accept-Language": "en-US,en;q=0.9",
                },
                "https:": {
                    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
                    "Accept-Language": "en-US,en;q=0.9",
                    "Sec-CH-UA": `"Chrome";v="${ this.#version }", "Chromium";v="${ this.#version }", "Not_A Brand";v="24"`,
                    "Sec-CH-UA-Mobile": config.mobile
                        ? "?1"
                        : "?0",
                    "Sec-CH-UA-Platform": `"${ config.os }"`,
                    "Sec-Fetch-Dest": "document",
                    "Sec-Fetch-Mode": "navigate",
                    "Sec-Fetch-Site": "none",
                    "Sec-Fetch-User": "?1",
                },
            };
        }

        config.writeConfig( location + "/browsers.json", data, { "readable": true } );

        return result( 200 );
    }

    async _getMeta () {
        return result( 200, {
            "chromeVersion": this.#version,
        } );
    }

    // private
    async #getVersion () {
        if ( this.#version ) return result( 200 );

        const res = await fetch( API_URL );
        if ( !res.ok ) return res;

        const data = await res.json();

        this.#version = data.channels.Stable.version.match( /^(\d+)/ )[ 1 ];

        return result( 200 );
    }
}
