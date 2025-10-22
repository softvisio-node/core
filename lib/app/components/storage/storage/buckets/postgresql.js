import "#lib/stream";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { TmpFile } from "#lib/tmp";
import Bucket from "../bucket.js";

export default class extends Bucket {
    #path;

    constructor ( buckets, location ) {
        super( buckets, location );

        this.#path = path.join( this.storage.app.env.dataDir, this.storage.config.location );
    }

    // public
    async init () {
        return result( 200 );
    }

    // XXX
    async imageExists ( imagePath, { dbh } = {} ) {
        dbh ||= this.dbh;

        return true;
    }

    // XXX
    async deleteImage ( imagePath, { dbh } = {} ) {
        dbh ||= this.dbh;

        return result( 200 );
    }

    // protected
    // XXX
    async _uploadImage ( imagePath, file, { encrypt, dbh } = {} ) {
        dbh ||= this.dbh;

        const res = await this.#getOid( imagePath, { dbh } );
        if ( !res.ok ) return res;
        const oid = res.data.oid;

        var stream = file.stream();

        if ( encrypt ) {
            stream = await this.app.crypto.encrypt( stream );
        }

        return dbh.largeObject.write( stream, { oid } );
    }

    // XXX
    async _getFile ( file, { dbh } = {} ) {
        dbh ||= this.dbh;

        const tmp = new TmpFile( {
            "name": path.basename( file.path ),
            "type": file.contentType,
        } );

        const readStream = fs.createReadStream( this.#buildImagePath( file.imagePath ) ),
            writeStream = fs.createWriteStream( tmp.path );

        try {
            if ( file.isEncrypted ) {
                await pipeline( await this.app.crypto.decrypt( readStream ), writeStream );
            }
            else {
                await pipeline( readStream, writeStream );
            }

            return result( 200, tmp );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }

    async _getBuffer ( file, { dbh } = {} ) {
        dbh ||= this.dbh;

        var res = await this.#getOid( file.imagePath, { dbh } );
        if ( !res.ok ) return res;
        const oid = res.data.oid;

        res = await dbh.largeFile.read( oid );
        if ( !res.ok ) return res;

        const buffer = res.data.buffer;

        return result( 200, buffer );
    }

    async _getStream ( file, { dbh } = {} ) {
        dbh ||= this.dbh;

        var res = await this.#getOid( file.imagePath, { dbh } );
        if ( !res.ok ) return res;
        const oid = res.data.oid;

        const stream = await dbh.largeObject.createReadStream( oid );

        return result( 200, stream );
    }

    // private
    async #getOid ( imagePath, { dbh } = {} ) {
        dbh ||= this.dbh;
    }

    #buildImagePath ( imagePath ) {
        return path.join( this.#path, imagePath );
    }
}
