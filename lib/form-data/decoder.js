import "#lib/result";
import "#lib/stream";
import Events from "#lib/events";
import StreamSplit from "#lib/stream/split";
import { parseContentDispositionHeader } from "#lib/utils/http";
import path from "path";

export default class extends Events {
    #started;
    #finished;
    #boundary;
    #split;

    constructor ( contentType, options = {} ) {
        super();

        // parse boundary
        if ( contentType ) {
            const match = contentType.match( /boundary=(.+)/ );

            if ( match ) {
                this.#boundary = match[1];

                // dequote boundary
                if ( this.#boundary.startsWith( `"` ) ) {
                    this.#boundary = this.#boundary.substring( 1, this.#boundary.length - 1 );
                }
            }
        }
    }

    // properties
    get isStarted () {
        return this.#started;
    }

    get isFinished () {
        return !!this.#finished;
    }

    // public
    async decode ( stream ) {
        if ( this.#started ) throw `Unexpected decode call`;

        this.#started = true;

        // no boundary
        if ( !this.#boundary ) return this.#finish( result( [400, `No multipart/form-data boundary found`] ) );

        // read first boundary
        const start = await stream.readChunk( this.#boundary.length + 2 ).catch( e => null ); // "--" + boundary

        // boundary is invalid
        if ( !start || start.toString() !== "--" + this.#boundary ) return this.#finish( result( [400, `Invalid multipart/form-data`] ) );

        this.#split = new StreamSplit( { "eol": "\r\n--" + this.#boundary } );

        this.#split.on( "chunk", this.#onChunk.bind( this ) );

        this.#split.once( "error", this.#finish.bind( this ) );

        this.#split.once( "complete", this.#finish.bind( this ) );

        stream.pipe( this.#split );
    }

    // private
    async #onChunk ( stream ) {
        const chunk = await stream.readChunk( 2 ).catch( e => null );

        // unable to read chunk
        if ( !chunk ) return stream.cancel( result( [400, `Invalid multipart/form-data`] ) );

        // last chunk, ignore stream
        else if ( chunk.toString() === "--" ) return stream.skip();

        // read headers
        var headers = await stream.readHttpHeaders().catch( e => null );

        // unable to read headers
        if ( !headers ) return stream.cancel( result( [400, `Invalid multipart/form-data`] ) );

        // parse headers
        headers = headers.split( "\r\n" ).reduce( ( headers, header ) => {
            const idx = header.indexOf( ":" );

            const value = header.substring( idx + 1 ).trim();
            header = header.substring( 0, idx ).trim().toLowerCase();

            headers[header] = value;

            if ( header === "content-disposition" ) {
                const parsed = parseContentDispositionHeader( value );

                // invalid content-disposition header
                if ( parsed.type !== "form-data" || !parsed.name ) return stream.cancel( result( [400, `Invalid multipart/form-data`] ) );

                headers.name = parsed.name;

                if ( parsed.filename ) headers.filename = path.basename( parsed.filename );
            }

            return headers;
        }, {} );

        // field name is not defined
        if ( !headers.name ) return stream.cancel( result( [400, `Invalid multipart/form-data`] ) );

        this.emit( "field", headers.name, stream, headers );
    }

    #finish ( error ) {
        if ( this.#finished ) return;

        this.#finished = true;

        const res = error ? result.catch( error, { "silent": true, "keepError": true } ) : result( 200 );

        if ( this.#split ) {
            this.#split.destroy( res );

            this.#split = null;
        }

        this.emit( "finish", res );
    }
}
