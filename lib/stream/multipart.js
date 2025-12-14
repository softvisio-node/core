import Blob from "#lib/blob";
import File from "#lib/file";
import Headers from "#lib/http/headers";
import stream from "#lib/stream";
import StreamJoiner from "#lib/stream/joiner";
import StreamSplitter from "#lib/stream/splitter";
import { objectIsPlain } from "#lib/utils";
import uuid from "#lib/uuid";

const TYPES = new Set( [

        //
        "alternative",
        "byteranges",
        "form-data",
        "mixed",
        "related",
    ] ),
    BOUNDARY_POSTFIX = Buffer.from( "--" ),
    EOL = Buffer.from( "\r\n" );

export class MultipartStreamEncoder extends StreamJoiner {
    #boundary;
    #autoEnd;
    #lastPart;
    #hasSize = true;

    constructor ( type, { boundary, autoEnd } = {} ) {
        super();

        if ( !TYPES.has( type ) ) throw new Error( "Type is invalid" );

        this.#boundary = boundary || this.constructor.generateBoundary();
        this.#autoEnd = Boolean( autoEnd );
        this.#lastPart = Buffer.from( `--${ this.#boundary }--\r\n` );

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
    write ( data, encoding, callback ) {
        this.#write( data, encoding, callback );
    }

    read ( size ) {
        if ( this.#autoEnd && !this.writableEnded ) {
            this.end();
        }

        return super.read( size );
    }

    // protected
    _flush ( callback ) {

        // write last part
        if ( this.hasPushedData ) {
            this.push( this.#lastPart );
        }

        callback();
    }

    // private
    #write ( data, encoding, callback ) {
        var partSize, type, name, filename, headers, body, transform;

        if ( objectIsPlain( data ) ) {
            ( { headers, body, type, name, filename, transform } = data );
        }
        else {
            body = data;
        }

        // stream is not writable
        if ( !this.writable ) {
            if ( body instanceof stream.Readable ) body.destroy();
            if ( transform ) transform.destroy();

            super.write( body, encoding, callback );

            return;
        }

        const promises = callback
            ? []
            : null;

        headers = new Headers( headers );

        type ||= headers.get( "content-type" );

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
            partSize = body.size;
            type ||= body.type;

            // file
            if ( body instanceof File ) filename ||= body.name;

            body = body.stream();
        }

        // buffer
        else if ( Buffer.isBuffer( body ) ) {
            partSize = body.length;
            body = stream.Readable.from( body );
        }

        // stream.Readable
        else if ( body instanceof stream.Readable ) {
            partSize = body.size;

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

        this.#writeData( header, null, promises );

        if ( transform ) {
            partSize = null;

            this.#writeData(
                stream.pipeline( body, transform, () => {} ),
                null,
                promises
            );
        }
        else {
            this.#writeData( body, encoding, promises );
        }

        this.#writeData( Buffer.from( "\r\n" ), null, promises );

        // track stream size
        if ( this.#hasSize ) {
            let size;

            if ( partSize == null ) {
                this.#hasSize = false;
            }
            else {
                size = this.size;

                size ??= this.#lastPart.length;

                size += header.length + partSize + 2;
            }

            this.setSize( size );
        }

        if ( promises ) {
            Promise.all( promises )
                .then( () => callback() )
                .catch( e => callback( e ) );
        }
    }

    #writeData ( data, encoding, promises ) {
        if ( promises ) {
            promises.push( new Promise( ( resolve, reject ) => {
                super.write( data, error => {
                    if ( error ) {
                        reject( error );
                    }
                    else {
                        resolve();
                    }
                } );
            } ) );
        }
        else {
            super.write( data, encoding );
        }
    }
}

export class MultipartStreamDecoder extends StreamSplitter {
    #boundary;
    #firstPart;
    #lastPart;

    constructor ( boundary ) {
        const eol = boundary
            ? "\r\n--" + boundary
            : null;

        super( {
            eol,
        } );

        this.#boundary = boundary;
    }

    // properties
    get boundary () {
        return this.#boundary;
    }

    // public
    push ( stream ) {
        if ( stream == null ) {
            super.push( stream );
        }
        else {
            this.#processPart( stream );
        }
    }

    // protected
    _construct ( callback ) {
        callback( this.#boundary
            ? null
            : "Unable to parse boundary" );
    }

    // private
    async #processPart ( stream ) {
        var chunk;

        try {

            // data after last part
            if ( this.#lastPart ) throw new Error();

            // first part
            if ( !this.#firstPart ) {
                this.#firstPart = true;

                const header = Buffer.from( "--" + this.boundary );

                chunk = await stream.readChunk( header.length );
                if ( !chunk ) throw new Error();

                if ( !chunk.equals( header ) ) throw new Error();
            }

            chunk = await stream.readChunk( 2 );
            if ( !chunk ) throw new Error();

            // last part
            if ( chunk.equals( BOUNDARY_POSTFIX ) ) {
                this.#lastPart = true;

                chunk = await stream.readChunk( 2 );
                if ( !chunk ) throw new Error();

                if ( !chunk.equals( EOL ) ) {
                    throw new Error();
                }

                // check part has no more data
                chunk = await stream.readChunk( 1 );
                if ( chunk ) throw new Error();

                stream.resume();

                return;
            }
            else if ( !chunk.equals( EOL ) ) {
                if ( chunk ) throw new Error();
            }

            var headers = await stream.readHttpHeaders();
            if ( !headers ) throw new Error();

            // parse headers
            headers = Headers.parse( headers );

            super.push( {
                headers,
                "body": stream,
            } );
        }
        catch {
            stream.destroy( "Invalid multipart data" );
        }
    }
}
