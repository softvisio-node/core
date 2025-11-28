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
    // XXX
    static async parse ( body, boundary, { maxBufferLength, maxFileSize } = {} ) {
        const multipartStreamDecoder = new MultipartStreamDecoder( boundary );

        stream.pipeline( body, multipartStreamDecoder, () => {} );
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
