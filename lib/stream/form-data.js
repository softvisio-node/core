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

        if ( !boundary ) throw Error( `Unable to parse boundary` );

        const eol = "\r\n--" + boundary;

        super( eol );

        this.#boundary = boundary;
    }

    // properties
    get boundary () {
        return this.#boundary;
    }

    // protected
    async _onNewStream ( stream ) {
        let length;

        if ( this.#firstChunk ) {
            this.#firstChunk = false;

            length = this.#boundary.length + 4;
        }
        else {
            length = 2;
        }

        // read prefix
        const chunk = await stream.readChunk( length ).catch( e => stream.destroy( e ) );
        if ( !chunk ) return;

        // ignore last chunk
        if ( chunk.toString() === "--" ) return stream.resume();

        var headers = await stream.readHttpHeaders().catch( e => stream.destroy( e ) );
        if ( !headers ) return;

        // parse headers
        headers = headers.split( "\r\n" ).reduce( ( headers, header ) => {
            const idx = header.indexOf( ":" );

            const value = header.substring( idx + 1 ).trim();
            header = header.substring( 0, idx ).trim();

            headers.append( header, value );

            return headers;
        }, new Headers() );

        // parse Content-Disposition header
        const contentDisposition = headers.contentDisposition;

        // validate Content-Disposition header
        if ( !contentDisposition ) return stream.destroy( `Content-Disposition header is missed` );

        if ( contentDisposition.type !== "form-data" || !contentDisposition.name ) return stream.destroy( `Invalid multipart/form-data` );

        this.emit( "data", stream, headers );
    }
}
