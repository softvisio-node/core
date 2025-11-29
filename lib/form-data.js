import stream from "#lib/stream";
import { MultipartStreamDecoder, MultipartStreamEncoder } from "#lib/stream/multipart";

export default class FormData extends MultipartStreamEncoder {
    constructor ( { type } = {} ) {
        super( type || "form-data", {
            "autoEnd": true,
        } );
    }

    // static
    static async parse ( multipartStream, { boundary, maxBufferLength, maxFileSize } = {} ) {
        if ( multipartStream instanceof MultipartStreamEncoder ) {
            boundary = multipartStream.boundary;
        }

        const multipartStreamDecoder = new MultipartStreamDecoder( boundary );

        stream.pipeline( multipartStream, multipartStreamDecoder, () => {} );

        const fields = {};

        for await ( const { headers, body } of multipartStreamDecoder ) {
            try {
                const contentDisposition = headers.contentDisposition,
                    name = contentDisposition.name || "";

                let value;

                // raw field or blob
                if ( !contentDisposition.filename || contentDisposition.filename === "blob" ) {
                    value = await body.buffer( { "maxLength": maxBufferLength } );
                }

                // file
                else {
                    value = await body.tmpFile( {
                        "maxLength": maxFileSize,
                        "name": contentDisposition.filename,
                        "type": headers.contentType?.type,
                    } );
                }

                if ( fields[ name ] == null ) {
                    fields[ name ] = { headers, value };
                }
                else {
                    if ( !Array.isArray( fields[ name ] ) ) fields[ name ] = [ fields[ name ] ];

                    fields[ name ].push( { headers, value } );
                }
            }
            catch ( e ) {
                body.destroy( e );

                throw e;
            }
        }

        return fields;
    }

    // public
    append ( name, body, filename ) {
        this.write( {
            body,
            name,
            filename,
        } );

        return this;
    }
}
