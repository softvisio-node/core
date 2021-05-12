import "#index";

import fs from "#lib/fs";
import File from "#lib/file";
import MSGPACK from "#lib/msgpack";
import Busboy from "busboy";

export default Super =>

    /** class: UploadMixin
     * summary: API upload protocol.
     */
    class extends ( Super || Object ) {
        uploadMaxSize = 1024 * 1024 * 50; // 50Mb

        async _upload ( req ) {
            const size = req.getHeader( "content-length" );

            if ( !size || size > this.uploadMaxSize ) return result( [400, `Upload size is invalid`] );

            return new Promise( resolve => {
                let res, file, data;

                const busboy = new Busboy( { "headers": { "content-type": req.getHeader( "content-type" ) } } );

                busboy.on( "field", ( name, value, fieldnameTruncated, valueTruncated, transferEncoding, mimeType ) => {
                    if ( name !== "data" ) return;

                    try {
                        if ( mimeType === "application/json" ) data = JSON.parse( value );
                        else if ( mimeType === "application/msgpack" ) data = MSGPACK.decode( value );
                        else throw result( [400, `Invalid content type`] );
                    }
                    catch ( e ) {
                        res = result.catchResult( e );
                    }
                } );

                busboy.on( "file", ( name, stream, filename, transferEncoding, type ) => {
                    if ( name !== "file" ) return;

                    file = new File( {
                        "name": filename,
                        "path": fs.tmp.file(),
                        type,
                    } );

                    stream.pipe( fs.createWriteStream( file.path + "" ) );
                } );

                busboy.on( "finish", () => {
                    if ( !res ) {
                        if ( !file ) res = result( [500, `Upload data is incomplete`] );
                        else res = result( 200 );
                    }

                    resolve( [res, file, data] );
                } );

                req.stream.pipe( busboy );
            } );
        }
    };
