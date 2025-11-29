import Blob from "#lib/blob";
import File from "#lib/file";
import Headers from "#lib/http/headers";
import stream from "#lib/stream";
import StreamJoiner from "#lib/stream/joiner";
import StreamSplitter from "#lib/stream/splitter";
import uuid from "#lib/uuid";

const TYPES = new Set( [

    //
    "alternative",
    "byteranges",
    "form-data",
    "mixed",
    "related",
] );

export class MultipartStreamEncoder extends StreamJoiner {
    #boundary;
    #lastChunk;
    #hasSize = true;

    constructor ( type, { boundary } = {} ) {
        super();

        if ( !TYPES.has( type ) ) throw new Error( "Type is invalid" );

        this.#boundary = boundary || this.constructor.generateBoundary();
        this.#lastChunk = Buffer.from( `--${ this.#boundary }--\r\n` );

        this.setType( `multipart/${ type }; boundary=${ this.boundary }` );
    }

    // static
    static generateBoundary () {
        return Buffer.from( ( uuid() + uuid() ).replaceAll( "-", "" ), "hex" ).toString( "base64url" );
    }

    // properties
    get boundary () {
        return this.#boundary;
    }

    // public
    append ( body, { name, type, filename, headers, transform } = {} ) {
        if ( !this.writable ) {
            if ( body instanceof stream.Readable ) {
                body.destroy();
            }

            if ( transform ) {
                transform.destroy();
            }

            return this;
        }

        // ignore undefined body
        if ( body === undefined ) {
            return this;
        }

        // string
        else if ( typeof body === "string" ) {
            body = Buffer.from( body );
        }

        // number
        else if ( typeof body === "number" ) {
            body = Buffer.from( String( body ) );
        }

        var length;

        // blob
        if ( body instanceof Blob ) {
            length = body.size;
            type ||= body.type;

            // file
            if ( body instanceof File ) filename ||= body.name;

            body = body.stream();
        }

        // buffer
        else if ( Buffer.isBuffer( body ) ) {
            length = body.length;
            body = stream.Readable.from( body );
        }

        // stream.Readable
        else if ( body instanceof stream.Readable ) {
            length = body.size;

            if ( body instanceof MultipartStreamDecoder ) {
                type = body.type;
            }
            else {
                type ||= body.type;
            }
        }

        // invalid body
        else {
            throw new Error( "Unsupported body type" );
        }

        headers = new Headers( headers );

        // add content-type
        if ( type ) {
            if ( filename ) {
                headers.set( "content-type", `${ type }; name="${ filename.replaceAll( '"', "%22" ) }"` );
            }
            else {
                headers.set( "content-type", type );
            }
        }

        // add content-disposition
        if ( name || filename ) headers.setContentDisposition( { name, filename } );

        // compose header
        const header = Buffer.from( `--${ this.boundary }\r\n` + headers.toString() + "\r\n" );

        this.write( header );

        if ( transform ) {
            length = null;

            this.write( stream.pipeline( body, transform, () => {} ) );
        }
        else {
            this.write( body );
        }

        this.write( "\r\n" );

        // track length
        if ( this.#hasSize ) {
            let size;

            if ( length == null ) {
                this.#hasSize = false;
            }
            else {
                size = this.size;

                size ??= this.#lastChunk.length;

                size += header.length + length + 2;
            }

            this.setSize( size );
        }

        return this;
    }

    // protected
    _flush ( callback ) {
        if ( this.dataWrote ) {
            this.push( this.#lastChunk );
        }

        callback();
    }
}

// XXX refactor
export class MultipartStreamDecoder extends StreamSplitter {
    #boundary;
    #maxBufferLength;
    #maxFileSize;
    #firstChunk;
    #lastChunk;

    constructor ( boundary, { maxBufferLength, maxFileSize } = {} ) {
        const eol = boundary
            ? "\r\n--" + boundary
            : "";

        super( { eol } );

        this.#maxBufferLength = maxBufferLength;
        this.#maxFileSize = maxFileSize;

        this.#boundary = boundary;
    }

    // properties
    get boundary () {
        return this.#boundary;
    }

    get maxBufferLength () {
        return this.#maxBufferLength;
    }

    get maxFileSize () {
        return this.#maxFileSize;
    }

    // protected
    _construct ( callback ) {
        callback( this.#boundary
            ? null
            : "Unable to parse boundary" );
    }

    async _processStream ( stream ) {
        try {

            // data after last chunk
            if ( this.#lastChunk ) throw "Invalid multipart/form-data";

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
            if ( !chunk ) throw "Invalid multipart/form-data";

            // last chunk
            if ( chunk.toString() === "--" ) {
                this.#lastChunk = true;

                // ignore last chunk
                stream.resume();

                return;
            }

            var headers = await stream.readHttpHeaders();
            if ( !headers ) throw "Invalid multipart/form-data";

            // parse headers
            headers = Headers.parse( headers );

            // parse content-disposition header
            const contentDisposition = headers.contentDisposition;

            // validate Content-Disposition header
            if ( !contentDisposition ) throw "Content-Disposition header is missed";

            if ( contentDisposition.type !== "form-data" || !contentDisposition.name ) throw "Invalid multipart/form-data";

            return { stream, headers };
        }
        catch {
            this.destroy( "Invalid multipart/form-data" );
        }
    }
}
