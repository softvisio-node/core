import Blob from "#lib/blob";
import File from "#lib/file";
import Headers from "#lib/http/headers";
import stream from "#lib/stream";
import StreamJoin from "#lib/stream/join";
import uuid from "#lib/uuid";

const TYPES = new Set( [

    //
    "alternative",
    "byteranges",
    "form-data",
    "mixed",
    "related",
] );

export default class StreamMultipart extends StreamJoin {
    #boundary;
    #hasSize = true;
    #lastChunk;

    constructor ( type ) {
        super();

        if ( !TYPES.has( type ) ) throw new Error( "Type is invalid" );

        this.#boundary = "--------------------------" + uuid();

        this.setType( `multipart/${ type }; boundary=${ this.boundary }` );
    }

    // properties
    get boundary () {
        return this.#boundary;
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
            body = Buffer.from( String( body ) );
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

        // multipart stream
        else if ( body instanceof StreamMultipart ) {
            length = body.length;
            type ||= body.type;
        }

        // stream.Readable
        else if ( body instanceof stream.Readable ) {
            type ||= body.type;
            length = body.size;
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
        if ( this.#hasSize ) {
            let size;

            if ( length == null ) {
                this.#hasSize = false;
            }
            else {
                size = this.size;

                size ??= this.#getLastChunk().length;

                size += header.length + length + 2;
            }

            this.setSize( size );
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
