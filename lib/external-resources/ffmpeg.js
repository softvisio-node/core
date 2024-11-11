import fs from "node:fs";
import path from "node:path";
import ExternalRecourceBuilder from "#lib/external-resource-builder";
import fetch from "#lib/fetch";
import Zip from "#lib/zip";

export default class Http extends ExternalRecourceBuilder {
    #url;
    #version;

    // properties
    get id () {
        return "softvisio-node/core/resources/ffmpeg";
    }

    // protected
    async _getEtag ( { etag, buildDate, meta } ) {
        const res = await fetch( await this.#getUrl(), {
            "method": "head",
        } );

        if ( !res.ok ) throw res;

        return result( 200, res.headers.get( "etag" ) );
    }

    async _build ( location ) {
        const res = await fetch( await this.#getUrl() );

        if ( !res.ok ) throw res;

        const tmpFile = await res.tmpFile();

        const zip = new Zip( tmpFile.path );

        for ( const entry of zip.getEntries() ) {
            if ( !entry.name || entry.isDirectory ) continue;

            const entryName = entry.entryName.replace( `ffmpeg-${ this.#version }-essentials_build/`, "" );

            fs.mkdirSync( location + "/" + path.dirname( entryName ), {
                "force": true,
                "recursive": true,
            } );

            fs.writeFileSync( location + "/" + entryName, entry.getData() );
        }

        return result( 200 );
    }

    async _getMeta () {
        return result( 200, {
            "version": this.#version,
        } );
    }

    // private
    async #getUrl () {
        if ( !this.#url ) {
            const res = await fetch( "https://www.gyan.dev/ffmpeg/builds/release-version" );

            if ( !res.ok ) throw res;

            this.#version = await res.text();

            this.#url = `https://github.com/GyanD/codexffmpeg/releases/download/${ this.#version }/ffmpeg-${ this.#version }-essentials_build.zip`;
        }

        return this.#url;
    }
}
