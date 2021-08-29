import "#lib/result";
import crypto from "crypto";
import fetch from "#lib/fetch";
import tar from "tar";
import fs from "fs";

const HASH_ALGORITHM = "sha3-512";

export default class Resource {

    // public
    isExists ( location ) {
        return false;
    }

    async getUpdated () {
        return result( [500, `Not Implemented`] );
    }

    async build ( tmp ) {
        return result( [500, `Not Implemented`] );
    }

    async update ( resources ) {
        if ( !fs.existsSync( resources.location ) ) fs.mkdirSync( resources.location, { "recursive": true } );

        const res = await fetch( `https://github.com/${resources.repo}/releases/download/${resources.tag}/${this.id}.tar.gz` );

        // request error
        if ( !res.ok ) return res;

        // download and unpack
        await new Promise( resolve => {
            const writable = tar.extract( {
                "cwd": resources.location,
                "sync": true,
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
