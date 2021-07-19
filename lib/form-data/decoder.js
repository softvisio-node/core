import "#lib/result";
import "#lib/stream";
import Events from "#lib/events";
import StreamSplit from "#lib/stream/split";
import { parseHTTPHeader } from "#lib/http/utils";

export default class extends Events {
    #headers;
    #stream;

    #started;
    #destroyed = false;
    #boundary;
    #split;
    #resolve;
    #result;

    constructor ( headers, stream, options = {} ) {
        super();

        this.#headers = headers;
        this.#stream = stream;
    }

    // properties
    get isStarted () {
        return this.#started;
    }

    get isDestroyed () {
        return this.#destroyed;
    }

    // public
    async decode () {
        if ( this.#destroyed ) return this.#result;

        if ( this.#started ) throw `Unexpected decode call`;
        this.#started = true;

        // content-type header is missed
        if ( !this.#headers["content-type"] ) return this.#destroy( result( 500 ) );

        const match = this.#headers["content-type"].match( /boundary=(.+)/ );

        // unable to parse boundary
        if ( !match ) return this.#destroy( result( 500 ) );

        this.#boundary = match[1];

        // read first boundary
        const start = await this.#stream.readChunk( this.#boundary.length + 2 ); // "--" + boundary

        // boundary is invalid
        if ( !start || start.toString() !== "--" + this.#boundary ) return this.#destroy( result( 500 ) );

        this.#split = new StreamSplit( { "eol": "\r\n--" + this.#boundary } );

        this.#split.on( "chunk", this.#onChunk.bind( this ) );

        this.#split.once( "close", () => this.#destroy() );

        this.#stream.once( "error", e => this.#destroy( result.catch( e ) ) );

        return new Promise( resolve => {
            this.#resolve = resolve;

            this.#stream.pipe( this.#split );
        } );
    }

    destroy ( res ) {
        this.#destroy( res || result( 500 ) );
    }

    // protected
    _read () {}

    _write ( data, enc, callback ) {
        this.push( data );

        callback( null );
    }

    // private
    #destroy ( res ) {
        if ( this.#destroyed ) return this.#result;

        this.#destroyed = true;
        this.#result = result.try( res );

        if ( this.#split ) this.#split.destroy( this.#result );

        this.#split = null;
        this.#stream = null;

        if ( this.#resolve ) {
            this.#resolve( this.#result );
            this.#resolve = null;
        }

        return this.#result;
    }

    async #onChunk ( stream ) {
        stream.once( "error", () => {} );

        const chunk = await stream.readChunk( 2 );

        // multipart/form-data error
        if ( !chunk ) return this.#destroy( result( 500 ) );

        // last chunk, finish
        else if ( chunk.toString() === "--" ) return this.#destroy( result( 200 ) );

        // read headers
        var headers = await stream.readHttpHeaders();

        // multipart/form-data error
        if ( !headers ) return this.#destroy( result( 500 ) );

        // parse headers
        headers = headers.split( "\r\n" ).reduce( ( headers, header ) => {
            const idx = header.indexOf( ":" );

            const value = header.substr( idx + 1 ).trim();
            header = header.substring( 0, idx ).trim().toLowerCase();

            headers[header] = value;

            if ( header === "content-disposition" ) {
                const parsed = parseHTTPHeader( value );

                // invalid content-disposition header
                if ( !parsed[0] || parsed[0][""] !== "form-data" || !parsed[0].name ) return this.#destroy( result( 500 ) );

                headers.name = parsed[0].name;
                headers.filename = parsed[0].filename;
            }

            return headers;
        }, {} );

        // field name is not defined
        if ( !headers.name ) return this.#destroy( result( 500 ) );

        if ( headers.filename ) {
            this.emit( "file", this, headers.name, stream, headers );
        }
        else {
            const value = await stream.slurp();

            if ( !value ) return this.#destroy( result( 500 ) );

            this.emit( "field", this, headers.name, value, headers );
        }
    }
}
