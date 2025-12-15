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
    #lastPart;

    constructor ( type, { boundary, autoEnd } = {} ) {
        super( {
            autoEnd,
        } );

        if ( !TYPES.has( type ) ) throw new Error( "Type is invalid" );

        this.#boundary = boundary || this.constructor.generateBoundary();
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
        var streamJoiner;

        if ( typeof chunk === "function" ) {
            const wrapper = () => {
                var args = chunk();

                if ( args == null ) {
                    return args;
                }
                else {
                    if ( !Array.isArray( args ) ) args = [ args ];

                    streamJoiner = this.#createStream( ...args );

                    return streamJoiner;
                }
            };

            return super.write( wrapper, null, callback );
        }
        else {
            try {
                streamJoiner = this.#createStream( chunk, encoding );

                // stream is not writable
                if ( !this.writable ) {
                    streamJoiner.destroy();
                }

                return super.write( streamJoiner, null, callback );
            }
            catch ( e ) {
                streamJoiner?.destroy();

                this.destroy( e );

                return super.write( streamJoiner, null, callback );
            }
        }
    }

    #createStream ( chunk, encoding ) {
        var type, name, filename, headers, body, transform;

        if ( objectIsPlain( chunk ) ) {
            ( { headers, body, type, name, filename, transform } = chunk );
        }
        else {
            body = chunk;
        }

        headers = new Headers( headers );

        type ||= headers.get( "content-type" );

        if ( typeof body === "function" ) {
            const callback = body;

            body = () => {
                var body = callback();

                if ( body != null ) {
                    ( { body } = this.#prepareBody( body, { encoding, type, filename, transform } ) );
                }

                return body;
            };
        }
        else {
            ( { body, type, filename } = this.#prepareBody( body, { encoding, type, filename, transform } ) );
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

        const streamJoiner = new StreamJoiner().once( "error", () => {} );

        streamJoiner.write( Buffer.from( `--${ this.boundary }\r\n${ headers.toString() }\r\n` ) );

        streamJoiner.write( body );

        streamJoiner.write( EOL );

        streamJoiner.end();

        return streamJoiner;
    }

    #prepareBody ( body, { encoding, type, filename, transform } = {} ) {

        // string
        if ( typeof body === "string" ) {
            body = Buffer.from( body, encoding );
        }

        // number
        else if ( typeof body === "number" ) {
            body = Buffer.from( String( body ) );
        }

        if ( !Buffer.isBuffer( body ) ) {

            // blob
            if ( body instanceof Blob ) {
                type = body.type;

                // file
                if ( body instanceof File ) filename ||= body.name;

                body = body.stream();
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
                transform?.destroy();

                throw new Error( "Unsupported body type" );
            }
        }

        if ( transform ) {
            if ( !( body instanceof stream.Readable ) ) {
                body = stream.Readable.from( body );
            }

            body = stream.pipeline( body, transform, () => {} );
        }

        return {
            body,
            type,
            filename,
        };
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
