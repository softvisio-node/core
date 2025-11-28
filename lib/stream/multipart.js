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
    #lastChunk;
    #hasSize = true;

    constructor ( type ) {
        super();

        if ( !TYPES.has( type ) ) throw new Error( "Type is invalid" );

        this.#boundary = "--" + Buffer.from( ( uuid() + uuid() ).replaceAll( "-", "" ), "hex" ).toString( "base64url" );
        this.#lastChunk = Buffer.from( `${ this.#boundary }--\r\n` );

        this.setType( `multipart/${ type }; boundary=${ this.boundary }` );
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

            if ( body instanceof StreamMultipart ) {
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
        const header = Buffer.from( `${ this.boundary }\r\n` + headers.toString() + "\r\n" );

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
