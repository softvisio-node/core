import stream from "#lib/stream";
import { MultipartStreamDecoder, MultipartStreamEncoder } from "#lib/stream/multipart";
import { objectIsPlain } from "#lib/utils";

export default class FormData extends MultipartStreamEncoder {
    constructor ( fields ) {
        super( "form-data" );

        if ( fields ) {
            for ( const field of fields ) this.append( ...field );
        }
    }

    // static
    static async parse ( boundary, body, { maxBufferLength, maxFileSize } = {} ) {
        const multipartStreamDecoder = new MultipartStreamDecoder( boundary, {
            maxBufferLength,
            maxFileSize,
        } );

        stream.pipeline( body, multipartStreamDecoder, () => {} );

        const fields = {};

        for await ( const { stream, headers } of this ) {
            const contentDisposition = headers.contentDisposition,
                name = contentDisposition.name;

            if ( !name ) continue;

            let value;

            // raw field or blob
            if ( !contentDisposition.filename || contentDisposition.filename === "blob" ) {
                value = await stream.buffer( { "maxLength": maxBufferLength } );
            }

            // file
            else {
                value = await stream.tmpFile( {
                    "maxLength": maxFileSize,
                    "name": contentDisposition.filename,
                    "type": headers.contentType?.type,
                } );
            }

            if ( fields[ name ] == null ) {
                fields[ name ] = { headers, value };
            }
            else {
                fields[ name ] = [ fields[ name ], { headers, value } ];
            }
        }

        return fields;
    }

    // public
    append ( name, body, filename ) {
        var type, headers, transform;

        if ( objectIsPlain( filename ) ) {
            ( { type, filename, headers, transform } = filename );
        }

        super.append( body, { name, type, filename, headers, transform } );

        return this;
    }
}
