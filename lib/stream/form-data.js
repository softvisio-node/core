import Headers from "#lib/http/headers";
import StreamSplit from "#lib/stream/split";

export default class StreamFormData extends StreamSplit {
    #boundary;
    #firstChunk;
    #lastChunk;

    constructor ( boundary ) {
        const eol = boundary
            ? "\r\n--" + boundary
            : "";

        super( eol );

        this.#boundary = boundary;
    }

    // properties
    get boundary () {
        return this.#boundary;
    }

    // public
    async getFields ( { maxBufferLength, maxFileSize } = {} ) {
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

    // protected
    _construct ( callback ) {
        callback( this.#boundary
            ? null
            : `Unable to parse boundary` );
    }

    async _processStream ( stream ) {
        try {

            // data after last chunk
            if ( this.#lastChunk ) throw `Invalid multipart/form-data`;

            let length;

            // first chunk
            if ( !this.#firstChunk ) {
                this.#firstChunk = true;

                length = this.eol.length;
            }
            else {
                length = 2;
            }

            // read prefix
            const chunk = await stream.readChunk( length );
            if ( !chunk ) throw `Invalid multipart/form-data`;

            // last chunk
            if ( chunk.toString() === "--" ) {
                this.#lastChunk = true;

                // ignore last chunk
                stream.resume();

                return;
            }

            var headers = await stream.readHttpHeaders();
            if ( !headers ) throw `Invalid multipart/form-data`;

            // parse headers
            headers = Headers.parse( headers );

            // parse content-disposition header
            const contentDisposition = headers.contentDisposition;

            // validate Content-Disposition header
            if ( !contentDisposition ) throw `Content-Disposition header is missed`;

            if ( contentDisposition.type !== "form-data" || !contentDisposition.name ) throw `Invalid multipart/form-data`;

            return { stream, headers };
        }
        catch {
            this.destroy( `Invalid multipart/form-data` );
        }
    }
}
