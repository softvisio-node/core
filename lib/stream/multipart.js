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
    write ( chunk, encoding, callback ) {
        this.#write( chunk, encoding, callback );
    }

    read ( size ) {

        // auto end stream on first read
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

    _setSize ( size ) {
        if ( size != null ) {
            if ( this.size == null ) {
                size = null;
            }
            else if ( this.size === 0 ) {
                size += this.#lastPart.length;
            }
        }

        return super._setSize( size );
    }

    // private
    #write ( chunk, encoding, callback ) {
        var type, name, filename, headers, body, transform;

        if ( objectIsPlain( chunk ) ) {
            ( { headers, body, type, name, filename, transform } = chunk );
        }
        else {
            body = chunk;
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
            body = Buffer.from( body, encoding );
        }

        // number
        else if ( typeof body === "number" ) {
            body = Buffer.from( String( body ) );
        }

        // blob
        if ( body instanceof Blob ) {
            type ||= body.type;

            // file
            if ( body instanceof File ) filename ||= body.name;

            body = body.stream();
        }

        // buffer
        else if ( Buffer.isBuffer( body ) ) {
            body = stream.Readable.from( body ).setSize( body.length );
        }

        // stream.Readable
        else if ( body instanceof stream.Readable ) {
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

        this.#writeChunk( header, null, promises );

        if ( transform ) {
            this.#writeChunk(
                stream.pipeline( body, transform, () => {} ),
                null,
                promises
            );
        }
        else {
            this.#writeChunk( body, encoding, promises );
        }

        this.#writeChunk( Buffer.from( "\r\n" ), null, promises );

        if ( promises ) {
            Promise.all( promises )
                .then( () => callback() )
                .catch( e => callback( e ) );
        }
    }

    #writeChunk ( chunk, encoding, promises ) {
        if ( promises ) {
            promises.push( new Promise( ( resolve, reject ) => {
                super.write( chunk, encoding, error => {
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
            super.write( chunk, encoding );
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
