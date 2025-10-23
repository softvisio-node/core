import "#lib/stream";
import fs from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import sql from "#lib/sql";
import { TmpFile } from "#lib/tmp";
import Bucket from "../bucket.js";

const SQL = {
    "getOid": sql`SELECT oid FROM storage_image WHERE path = ?`.prepare(),

    "checkOid": sql`SELECT oid FROM pg_largeobject_metadata WHERE oid = ?`.prepare(),

    "updateImageOid": sql`UPDATE storage_image SET oid = ? WHERE id = ?`.prepare(),
};

export default class extends Bucket {

    // public
    async init () {
        return result( 200 );
    }

    async imageExists ( image, { dbh } = {} ) {
        dbh ||= this.dbh;

        var res, oid;

        if ( image.oid ) {
            oid = image.oid;
        }
        else {
            res = await dbh.selectRow( SQL.getOid, [ image.path ] );
            if ( !res.ok ) return null;

            oid = res.data?.oid;
        }

        if ( !oid ) {
            return false;
        }
        else {
            res = await dbh.selectRow( SQL.checkOid, [ oid ] );
            if ( !res.ok ) return null;

            return res.data?.oid
                ? true
                : false;
        }
    }

    async deleteImage ( image, { dbh } = {} ) {
        dbh ||= this.dbh;

        return dbh.largeObject.unlink( image.oid );
    }

    // protected
    async _uploadImage ( image, file, { encrypt, dbh } = {} ) {
        dbh ||= this.dbh;

        var res, oid;

        if ( image.oid ) {
            oid = image.oid;
        }
        else {
            res = await dbh.selectRow( SQL.getOid, [ image.path ] );
            if ( !res.ok ) return res;

            oid = res.data?.oid;
        }

        var stream = file.stream();

        if ( encrypt ) {
            stream = await this.app.crypto.encrypt( stream );
        }

        return dbh.begin( async dbh => {
            var res;

            res = await dbh.largeObject.write( stream, { oid } );
            if ( !res.ok ) throw res;

            // update image oid
            if ( !oid ) {
                oid = res.data.oid;

                res = await dbh.do( SQL.updateImageOid, [ oid, image.id ] );
                if ( !res.ok ) throw res;

                if ( !res.meta.rows ) throw "Storage image OID not updated";
            }

            return result( 200 );
        } );
    }

    async _getFile ( file, { dbh } = {} ) {
        dbh ||= this.dbh;

        const tmp = new TmpFile( {
            "name": path.basename( file.path ),
            "type": file.contentType,
        } );

        const readStream = dbh.createReadStream( file.imageOid ),
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

        const res = await dbh.largeFile.read( file.imageOid );
        if ( !res.ok ) return res;

        const buffer = res.data.buffer;

        return result( 200, buffer );
    }

    async _getStream ( file, { dbh } = {} ) {
        dbh ||= this.dbh;

        const stream = await dbh.largeObject.createReadStream( file.imageOid );

        return result( 200, stream );
    }
}
