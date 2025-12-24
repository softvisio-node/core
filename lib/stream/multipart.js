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
        if ( typeof encoding === "function" ) {
            callback = encoding;

            encoding = undefined;
        }

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

            return super.write( wrapper, callback );
        }
        else {
            try {
                streamJoiner = this.#createStream( chunk, encoding );

                // stream is not writable
                if ( !this.writable ) {
                    streamJoiner.destroy();
                }

                return super.write( streamJoiner, callback );
            }
            catch ( e ) {
                streamJoiner?.destroy();

                this.destroy( e );

                return super.write( streamJoiner, callback );
            }
        }
    }

    // protected
    _flush ( callback ) {

        // write last part
        this.push( this.#lastPart );

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
    #boundaryBuffer;
    #firstBoundary;
    #ended;

    constructor ( boundary ) {
        const eol = boundary
            ? "\r\n--" + boundary
            : null;

        super( {
            eol,
        } );

        this.#boundary = boundary;
        this.#boundaryBuffer = Buffer.from( "--" + this.#boundary );
    }

    // properties
    get boundary () {
        return this.#boundary;
    }

    // public
    push ( stream ) {
        if ( stream == null ) {
            return super.push( stream );
        }
        else {
            this.#processPart( stream );

            return true;
        }
    }

    // protected
    _construct ( callback ) {
        callback( this.#boundary
            ? null
            : "Unable to parse boundary" );
    }

    _transform ( chunk, encoding, callback ) {
        if ( this.#firstBoundary === true ) {
            super._transform( chunk, encoding, callback );
        }
        else {
            if ( this.#firstBoundary ) {
                this.#firstBoundary = Buffer.concat( [ this.#firstBoundary, chunk ] );
            }
            else {
                this.#firstBoundary = chunk;
            }

            if ( this.#firstBoundary.length < this.#boundaryBuffer.length ) {
                callback();
            }
            else if ( this.#firstBoundary.subarray( 0, this.#boundaryBuffer.length ).equals( this.#boundaryBuffer ) ) {
                chunk = this.#firstBoundary.subarray( this.#boundaryBuffer.length );

                this.#firstBoundary = true;

                if ( chunk.length ) {
                    super._transform( chunk, encoding, callback );
                }
                else {
                    callback();
                }
            }
            else {
                callback( new Error( "Invalid multipart data" ) );
            }
        }
    }

    // private
    async #processPart ( stream ) {
        var chunk;

        try {
            ERROR: {

                // data after last part
                if ( this.#ended ) break ERROR;

                chunk = await stream.readChunk( 4 );
                if ( !chunk ) break ERROR;

                // end
                if ( chunk.subarray( 0, 2 ).equals( BOUNDARY_POSTFIX ) ) {
                    this.#ended = true;

                    if ( !chunk.subarray( 2 ).equals( EOL ) ) break ERROR;

                    // check part has no more data
                    chunk = await stream.readChunk( 1 );
                    if ( chunk ) break ERROR;

                    stream.resume();
                }

                // part
                else {
                    if ( !chunk.subarray( 0, 2 ).equals( EOL ) ) break ERROR;

                    var headers;

                    if ( chunk.subarray( 2 ).equals( EOL ) ) {
                        headers = new Headers();
                    }
                    else {
                        stream.unshift( chunk.subarray( 2 ) );

                        headers = await stream.readHttpHeaders();
                        if ( !headers ) break ERROR;

                        // parse headers
                        headers = Headers.parse( headers );
                    }

                    super.push( {
                        headers,
                        "body": stream,
                    } );
                }

                return;
            }

            stream.destroy( new Error( "Invalid multipart data" ) );
        }
        catch ( e ) {
            stream.destroy( e );
        }
    }
}
