import Blob from "#lib/blob";
import File from "#lib/file";
import FileStream from "#lib/file-stream";
import Headers from "#lib/http/headers";
import stream from "#lib/stream";
import StreamCombined from "#lib/stream/combined";
import uuid from "#lib/uuid";

const TYPES = new Set( [ "form-data", "alternative", "mixed", "related" ] );

export default class StreamMultipart extends StreamCombined {
    #boundary;
    #type;
    #length;
    #lastChunk;

    constructor ( type ) {
        super();

        if ( !TYPES.has( type ) ) throw new Error( `Type is invalid` );

        this.#boundary = "--------------------------" + uuid();

        this.#type = `multipart/${ type }; boundary=${ this.boundary }`;
    }

    // properties
    get boundary () {
        return this.#boundary;
    }

    get length () {
        return this.#length;
    }

    get type () {
        return this.#type;
    }

    // public
    append ( body, { name, type, filename, headers, transform } = {} ) {
        var length;

        // ignore undefined body
        if ( body === undefined ) {
            return this;
        }

        // string
        if ( typeof body === "string" ) {
            body = Buffer.from( body );
        }

        // number
        else if ( typeof body === "number" ) {
            body = Buffer.from( body + "" );
        }

        // blob
        if ( body instanceof Blob ) {
            type ||= body.type;
            length = body.size;

            // file
            if ( body instanceof File ) filename ||= body.name;

            body = body.stream();
        }

        // buffer
        else if ( Buffer.isBuffer( body ) ) {
            length = body.length;
            body = stream.Readable.from( body, { "objectMode": false } );
        }

        // file stream
        else if ( body instanceof FileStream ) {
            type ||= body.type;
            length = body.size;
        }

        // multipart stream
        else if ( body instanceof StreamMultipart ) {
            length = body.length;
            type ||= body.type;
        }

        // invalid body
        else if ( !( body instanceof stream.Readable ) ) {
            throw new Error( `Unsupported body type` );
        }

        headers = new Headers( headers );

        // add content-type
        if ( type ) {
            if ( filename ) {
                headers.set( "content-type", `${ type }; name="${ filename.replaceAll( `"`, `%22` ) }"` );
            }
            else {
                headers.set( "content-type", type );
            }
        }

        // add content-disposition
        if ( name || filename ) headers.setContentDisposition( { name, filename } );

        // compose header
        const header = Buffer.from( `--${ this.boundary }\r\n` + headers.toString() + "\r\n" );

        super.append( header );

        if ( transform ) {
            length = null;

            super.append( stream.pipeline( body, transform, () => {} ) );
        }
        else {
            super.append( body );
        }

        super.append( isLast => {
            var chunk = "\r\n";

            if ( isLast ) chunk += this.#getLastChunk();

            return chunk;
        } );

        // track length
        if ( this.#length !== null ) {
            if ( length == null ) {
                this.#length = null;
            }
            else {
                this.#length ??= this.#getLastChunk().length;

                this.#length += header.length + length + 2;
            }
        }

        return this;
    }

    // private
    #getLastChunk () {
        if ( !this.#lastChunk ) {
            this.#lastChunk = `--${ this.boundary }--\r\n`;
        }

        return this.#lastChunk;
    }
}
