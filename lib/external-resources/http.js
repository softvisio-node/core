import * as config from "#lib/config";
import ExternalRecourceBuilder from "#lib/external-resource-builder";

// NOTE https://developers.google.com/privacy-sandbox/blog/user-agent-reduction-android-model-and-version

const API_URL = "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions.json",
    PLATFORMS = {
        "android": {
            "platform": "(Linux; Android 10; K)",
            "os": "Android",
            "mobile": " Mobile",
        },
        "darwin": {
            "platform": "(Macintosh; Intel Mac OS X 10_15_7)",
            "os": "macOS",
            "mobile": "",
        },
        "linux": {
            "platform": "(X11; Linux x86_64)",
            "os": "Linux",
            "mobile": "",
        },
        "win32": {
            "platform": "(Windows NT 10.0; Win64; x64)",
            "os": "Windows",
            "mobile": "",
        },
    };

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

        for ( const [ platform, config ] of Object.entries( PLATFORMS ) ) {
            data[ platform ] = {
                "userAgent": `Mozilla/5.0 ${ config.platform } AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${ this.#version }.0.0.0${ config.mobile } Safari/537.36`,
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
        return {
            "chromeVersion": this.#version,
        };
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
