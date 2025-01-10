import fs from "node:fs";
import path from "node:path";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";
import { chmodSync } from "#lib/fs";
import Zip from "#lib/zip";

const PRODUCT = "chrome-headless-shell",
    CHANNEL = "stable",
    PLATFORM = "darwin-x64";

const ID = `softvisio-node/core/resources/google-${ PRODUCT }-${ CHANNEL }-${ PLATFORM }`,
    PRODUCTS = {
        "chrome-for-testing": "chrome",
        "chrome-headless-shell": "chrome-headless-shell",
    },
    CHANNELS = {
        "stable": "Stable",
        "beta": "Beta",
        "dev": "Dev",
        "canary": "Canary",
    },
    PLATFORMS = {
        "darwin-x64": "mac-x64",
        "darwin-arm64": "mac-arm64",
        "linux-x64": "linux64",
        "win32-x64": "win64",
        "win32-x86": "win32",
    },
    API_PRODUCT = PRODUCTS[ PRODUCT ],
    API_CHANNEL = CHANNELS[ CHANNEL ],
    API_PLATFORM = PLATFORMS[ PLATFORM ],
    API_URL = "https://googlechromelabs.github.io/chrome-for-testing/last-known-good-versions-with-downloads.json";

export default class Http extends ExternalRecourceBuilder {
    #version;

    // properties
    get id () {
        return ID;
    }

    // protected
    async _getEtag () {
        const res = await this.#getVersion();
        if ( !res.ok ) return res;

        return result( 200, this.#version.version );
    }

    async _build ( location ) {
        var res = await this.#getVersion();
        if ( !res.ok ) return res;

        res = await fetch( this.#version.url );
        if ( !res.ok ) throw res;

        const tmpFile = await res.tmpFile(),
            zip = new Zip( tmpFile.path );

        for ( const entry of zip.getEntries() ) {
            if ( !entry.name || entry.isDirectory ) continue;

            const entryName = entry.entryName.replace( `${ API_PRODUCT }-${ API_PLATFORM }/`, "" );

            fs.mkdirSync( location + "/" + path.dirname( entryName ), {
                "force": true,
                "recursive": true,
            } );

            fs.writeFileSync( location + "/" + entryName, entry.getData() );

            // chmod
            if ( path.basename( entryName ) === "chrome-headless-shell" ) {
                chmodSync( location + "/" + entryName, "rwxr-xr-x" );
            }
        }

        return result( 200 );
    }

    async _getMeta () {
        return result( 200, this.#version );
    }

    // private
    async #getVersion () {
        if ( this.#version ) return result( 200 );

        const res = await fetch( API_URL );
        if ( !res.ok ) return res;

        const data = await res.json();

        this.#version = {};
        this.#version.version = data.channels[ API_CHANNEL ].version;
        this.#version.revision = data.channels[ API_CHANNEL ].revision;

        for ( const row of data.channels[ API_CHANNEL ].downloads[ API_PRODUCT ] ) {
            if ( row.platform === API_PLATFORM ) {
                this.#version.url = row.url;

                break;
            }
        }

        return result( 200 );
    }
}
