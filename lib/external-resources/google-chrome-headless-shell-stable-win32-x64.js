import fs from "node:fs";
import path from "node:path";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";
import Zip from "#lib/zip";

const PRODUCT = "chrome-headless-shell",
    CHANNEL = "Stable",
    PLATFORM = "win64",
    PLATFORM_MATRIX = {
        "linux64": { "platform": "linux", "architecture": "x64" },
        "mac-x64": { "platform": "darwin", "architecture": "x64" },
        "win64": { "platform": "win32", "architecture": "x64" },
    },
    ID = `softvisio-node/core/resources/google-${ PRODUCT }-${ CHANNEL }-${ PLATFORM_MATRIX[ PLATFORM ].platform }-${ PLATFORM_MATRIX[ PLATFORM ].architecture }`,
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

            const entryName = entry.entryName.replace( `${ PRODUCT }-${ PLATFORM }/`, "" );

            fs.mkdirSync( location + "/" + path.dirname( entryName ), {
                "force": true,
                "recursive": true,
            } );

            fs.writeFileSync( location + "/" + entryName, entry.getData() );
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
        this.#version.version = data.channels[ CHANNEL ].version;
        this.#version.revision = data.channels[ CHANNEL ].revision;

        for ( const row of data.channels[ CHANNEL ].downloads[ PRODUCT ] ) {
            if ( row.platform === PLATFORM ) {
                this.#version.url = row.url;

                break;
            }
        }

        return result( 200 );
    }
}
