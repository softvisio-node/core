import StreamMultipart from "#lib/stream/multipart";

export default class FormData extends StreamMultipart {
    constructor () {
        super( "form-data" );
    }

    // public
    append ( name, content, { type, size, filename, headers, transform } = {} ) {
        return super.append( content, { name, type, size, filename, headers, transform } );
    }
}
