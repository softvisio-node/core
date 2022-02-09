import StreamSplit from "#lib/stream/split";
import Headers from "#lib/http/headers";

export default class StreamFormData extends StreamSplit {
    #boundary;
    #firstChunk = true;

    constructor ( contentType ) {
        var boundary;

        // parse boundary
        if ( contentType ) {
            const match = contentType.match( /boundary=(.+)/ );

            if ( match ) {
                boundary = match[1];

                // dequote boundary
                if ( boundary.startsWith( `"` ) ) {
                    boundary = boundary.substring( 1, boundary.length - 1 );
                }
            }
        }

        const eol = boundary ? "\r\n--" + boundary : "";

        super( eol );

        this.#boundary = boundary;
    }

    // properties
    get boundary () {
        return this.#boundary;
    }

    // protected
    _construct ( callback ) {
        callback( this.#boundary ? null : `Unable to parse boundary` );
    }

    async _processStream ( stream ) {
        try {
            let length;

            if ( this.#firstChunk ) {
                this.#firstChunk = false;

                length = this.eol.length;
            }
            else {
                length = 2;
            }

            // read prefix
            const chunk = await stream.readChunk( length );
            if ( !chunk ) throw `Invalid multipart/form-data`;

            // ignore last chunk
            if ( chunk.toString() === "--" ) {
                stream.resume();

                return;
            }

            var headers = await stream.readHttpHeaders();
            if ( !headers ) throw `Invalid multipart/form-data`;

            // parse headers
            headers = Headers.parse( headers );

            // parse Content-Disposition header
            const contentDisposition = headers.contentDisposition;

            // validate Content-Disposition header
            if ( !contentDisposition ) throw `Content-Disposition header is missed`;

            if ( contentDisposition.type !== "form-data" || !contentDisposition.name ) throw `Invalid multipart/form-data`;

            return { stream, headers };
        }
        catch ( e ) {
            this.destroy( `Invalid multipart/form-data` );
        }
    }
}
