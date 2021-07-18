import stream from "#lib/stream";
import StreamSplit from "#lib/stream/split";

export default class extends stream.Duplex {
    #boundary;
    #split;

    constructor ( boundary ) {
        super();

        this.#boundary = boundary;

        this.on( "pipe", this.#onPipe.bind( this ) );
    }

    // protected
    _read () {}

    _write ( data, enc, callback ) {
        this.push( data );

        callback( null );
    }

    // private
    // XXX
    async #onPipe ( stream ) {

        // read first boundary
        const start = await this.readChunk( this.#boundary.length + 2 ); // "--" + boundary

        // XXX
        // boundary is invalid
        if ( !start || start.toString() !== "--" + this.#boundary ) throw `Invalid multipart message`;

        this.#split = new StreamSplit( { "eol": "\r\n--" + this.#boundary } );

        this.#split.on( "chunk", this.#onChunk.bind( this ) );

        this.pipe( this.#split );
    }

    // XXX
    async #onChunk ( stream ) {
        const chunk = await stream.readChunk( 2 );

        // XXX
        // protocol error
        if ( !chunk ) throw `Error`;

        // last chunk
        else if ( chunk.toString() === "--" ) throw `Error`;

        // read headers
        var headers = await stream.readHttpHeaders();

        if ( !headers ) throw `Error`;

        // parse headers
        headers = headers.split( "\r\n" ).reduce( ( headers, header ) => {
            const idx = header.indexOf( ":" );

            const value = header.substr( idx + 1 ).trim();
            header = header.substring( 0, idx ).trim().toLowerCase();

            headers[header] = value;

            if ( header === "content-disposition" ) {

                // XXX  form-data; name="file2"; filename="1.js"
            }

            return headers;
        }, {} );

        // XXX emit field
        this.emit( "file", stream, headers );
    }
}
