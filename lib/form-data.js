import StreamMultipart from "#lib/stream/multipart";

export default class FormData extends StreamMultipart {
    constructor () {
        super( "form-data" );
    }

    // public
    append ( name, content, headers ) {
        return super.append( content, { name, headers } );
    }
}
