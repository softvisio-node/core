import "#index";

import fs from "#lib/fs";
import File from "#lib/file";
import MSGPACK from "#lib/msgpack";
import FormData from "#lib/form-data";

export default Super =>

    /** class: UploadMixin
     * summary: API upload protocol.
     */
    class extends ( Super || Object ) {
        uploadMaxSize = 1024 * 1024 * 50; // 50Mb

        async _upload ( req, options = {} ) {
            const size = req.headers["content-length"];

            // check max. size
            if ( !size || size > ( options.maxSize || this.uploadMaxSize ) ) return [result( [400, `Upload size is invalid`] )];

            return new Promise( resolve => {
                let res, file, data, dataType;

                const formData = FormData.decode( req.stream, { "headers": req.headers } );

                formData.on( "field", ( name, value, fieldnameTruncated, valueTruncated, transferEncoding, type ) => {
                    if ( name !== "data" ) return;

                    dataType = type;
                    data = value;
                } );

                formData.on( "file", ( name, stream, filename, transferEncoding, type ) => {
                    if ( name === "file" ) {
                        file = new File( {
                            "name": filename,
                            "path": fs.tmp.file(),
                            type,
                        } );

                        stream.pipe( fs.createWriteStream( file.path + "" ) );
                    }
                    else if ( name === "data" ) {
                        dataType = type;

                        const buffers = [];

                        stream.on( "data", data => buffers.push( data ) );

                        stream.on( "end", () => {
                            if ( !buffers.length ) data = null;
                            else if ( buffers.length === 1 ) data = buffers[0];
                            else data = Buffer.concat( buffers );
                        } );
                    }
                } );

                formData.on( "finish", () => {
                    if ( !res ) {
                        if ( !file ) res = result( [500, `Upload data is incomplete`] );

                        // decode data
                        else if ( data ) {
                            try {
                                if ( !dataType || dataType.startsWith( "application/json" ) ) data = JSON.parse( data );
                                else if ( dataType.startsWith( "application/msgpack" ) ) {
                                    req.isBinary = true;

                                    data = MSGPACK.decode( data );
                                }
                                else throw result( [400, `Invalid content type`] );
                            }
                            catch ( e ) {
                                res = result.catchResult( e );
                            }
                        }
                    }

                    resolve( [res ?? result( 200 ), file, data] );
                } );
            } );
        }
    };
