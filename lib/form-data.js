import StreamMultipart from "#lib/stream/multipart";
import { objectIsPlain } from "#lib/utils";

export default class FormData extends StreamMultipart {
    constructor ( fields ) {
        super( "form-data" );

        if ( fields ) {
            for ( const field of fields ) this.append( ...field );
        }
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
