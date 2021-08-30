import "#lib/result";
import crypto from "crypto";
import fetch from "#lib/fetch";
import tar from "tar";
import fs from "fs";
import env from "#lib/env";

const HASH_ALGORITHM = "sha3-512";
const userConfig = await env.getUserConfig();

export default class Resource {
    #resources;

    constructor ( resources ) {
        this.#resources = resources;
    }

    // properties
    get resources () {
        return this.#resources;
    }

    get userConfig () {
        return userConfig;
    }

    // public
    isConsistent () {
        for ( const filename of this.files ) {
            if ( !fs.existsSync( this.#resources.location + "/" + filename ) ) return false;
        }

        return true;
    }

    async getEtag () {
        return result( [500, `Not Implemented`] );
    }

    async build ( location ) {
        return result( [500, `Not Implemented`] );
    }

    async update () {
        const res = await fetch( `https://github.com/${this.#resources.repo}/releases/download/${this.#resources.tag}/${this.id}.tar.gz` );

        // request error
        if ( !res.ok ) return res;

        // download and unpack
        return new Promise( resolve => {
            const writable = tar.extract( {
                "cwd": this.#resources.location,
            } );

            res.body.pipe( writable );

            writable.on( "end", () => resolve( result( 200 ) ) );
        } );
    }

    // protected
    _getHash () {
        return crypto.createHash( HASH_ALGORITHM );
    }

    async _getLastModified ( url ) {
        const res = await fetch( url, {
            "method": "head",
            "timeout": 30000,
        } );

        // request error
        if ( !res.ok ) return res;

        const lastModified = res.headers.get( "last-modified" );

        if ( lastModified ) {
            return result( 200, new Date( lastModified ) );
        }
        else {
            return result( [500] );
        }
    }
}
