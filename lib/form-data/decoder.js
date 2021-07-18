import "#lib/result";
import "#lib/stream";
import Events from "#lib/events";
import StreamSplit from "#lib/stream/split";

export default class extends Events {
    #headers;
    #stream;

    #destroyed = false;
    #boundary;
    #split;
    #resolve;

    constructor ( headers, stream, options = {} ) {
        super();

        this.#headers = headers;
        this.#stream = stream;
    }

    // properties
    get isDestroyed () {
        return this.#destroyed;
    }

    // public
    async decode () {

        // parse boundary
        if ( !this.#headers["content-type"] ) return result( 500 );

        const match = this.#headers["content-type"].match( /boundary=(.+)/ );

        if ( !match ) return result( 500 );

        this.#boundary = match[1];

        // read first boundary
        const start = await this.#stream.readChunk( this.#boundary.length + 2 ); // "--" + boundary

        // XXX
        // boundary is invalid
        if ( !start || start.toString() !== "--" + this.#boundary ) return result( 500 );

        this.#split = new StreamSplit( { "eol": "\r\n--" + this.#boundary } );

        this.#split.on( "chunk", this.#onChunk.bind( this ) );

        this.#stream.once( "close", () => this.#destroy() );

        this.#stream.once( "error", e => this.#destroy( result( [500, e] ) ) );

        return new Promise( resolve => {
            this.#resolve = resolve;

            this.#stream.pipe( this.#split );
        } );
    }

    // XXX
    destroy ( res ) {
        this.#destroy( res );
    }

    // protected
    _read () {}

    _write ( data, enc, callback ) {
        this.push( data );

        callback( null );
    }

    // private
    #destroy ( res ) {
        if ( this.#destroyed ) return;

        this.#destroyed = true;

        this.#split.destroy( res );

        this.#split = null;
        this.#stream = null;

        this.#resolve( res );

        this.#resolve = null;
    }

    // XXX
    async #onChunk ( stream ) {
        stream.once( "error", () => {} );

        const chunk = await stream.readChunk( 2 );

        // XXX
        // protocol error
        if ( !chunk ) return this.#destroy( result( 500 ) );

        // last chunk
        // XXX read last \r\n???
        else if ( chunk.toString() === "--" ) return;

        // read headers
        var headers = await stream.readHttpHeaders();

        if ( !headers ) return this.#destroy( result( 500 ) );

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
        this.emit( "file", this, stream, headers );
    }
}
