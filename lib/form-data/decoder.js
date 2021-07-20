import "#lib/result";
import "#lib/stream";
import Events from "#lib/events";
import StreamSplit from "#lib/stream/split";
import { parseHTTPHeader } from "#lib/http/utils";
import CondVar from "#lib/threads/condvar";
import path from "path";

export default class extends Events {
    #stream;

    #started;
    #destroyed = false;
    #boundary;
    #split;
    #result;
    #cv = new CondVar();

    constructor ( stream, headers, options = {} ) {
        super();

        this.#stream = stream;

        // parse boundary
        if ( headers && headers["content-type"] ) {
            const match = headers["content-type"].match( /boundary=(.+)/ );

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

    get isDestroyed () {
        return this.#destroyed;
    }

    // public
    async decode () {
        if ( this.#destroyed ) return this.#result;

        if ( this.#started ) throw `Unexpected decode call`;
        this.#started = true;

        // no boundary
        if ( !this.#boundary ) return this.#error( result( [400, `No multipart/form-data boundary found`] ) );

        // read first boundary
        const start = await this.#stream.readChunk( this.#boundary.length + 2 ); // "--" + boundary

        // boundary is invalid
        if ( !start || start.toString() !== "--" + this.#boundary ) return this.#error( result( [400, `Invalid multipart/form-data`] ) );

        this.#cv.begin();

        this.#split = new StreamSplit( { "eol": "\r\n--" + this.#boundary } );

        this.#split.on( "chunk", this.#onChunk.bind( this ) );

        this.#split.once( "error", e => this.#error( e ) );

        this.#split.once( "close", () => this.#cv.end() );

        this.#stream.pipe( this.#split );

        await this.#cv.recv();

        this.#result ||= result( 200 );

        return this.#result;
    }

    // private
    async #onChunk ( stream ) {
        this.#cv.begin();

        // ignore chunk stream errors
        stream.once( "error", e => this.#error( e ) );

        stream.once( "close", () => this.#cv.end() );

        const chunk = await stream.readChunk( 2 );

        // unable to read chunk
        if ( !chunk ) return stream.destroy( result( [400, `Invalid multipart/form-data`] ) );

        // last chunk, ignore stream
        else if ( chunk.toString() === "--" ) return stream.destroy();

        // read headers
        var headers = await stream.readHttpHeaders();

        // unable to read headers
        if ( !headers ) return stream.destroy( result( [400, `Invalid multipart/form-data`] ) );

        // parse headers
        headers = headers.split( "\r\n" ).reduce( ( headers, header ) => {
            const idx = header.indexOf( ":" );

            const value = header.substr( idx + 1 ).trim();
            header = header.substring( 0, idx ).trim().toLowerCase();

            headers[header] = value;

            if ( header === "content-disposition" ) {
                const parsed = parseHTTPHeader( value );

                // invalid content-disposition header
                if ( !parsed[0] || parsed[0][""] !== "form-data" || !parsed[0].name ) return stream.destroy( result( [400, `Invalid multipart/form-data`] ) );

                headers.name = parsed[0].name;
                if ( parsed[0].filename ) headers.filename = path.basename( parsed[0].filename );
            }

            return headers;
        }, {} );

        // field name is not defined
        if ( !headers.name ) return stream.destroy( result( [400, `Invalid multipart/form-data`] ) );

        this.emit( "field", headers.name, stream, headers );
    }

    #error ( res ) {
        if ( this.#destroyed ) return this.#result;

        this.#destroyed = true;
        this.#result = typeof res === "string" ? result( [400, res] ) : result.catch( res, { "silent": true, "keepError": true } );

        if ( this.#split ) {
            this.#split.destroy( this.#result );
            this.#split = null;
        }

        this.#stream = null;

        return this.#result;
    }
}
