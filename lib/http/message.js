import { createBrotliCompress, createDeflate, createGzip } from "node:zlib";
import Blob from "#lib/blob";
import File from "#lib/file";
import Headers from "#lib/http/headers";
import mime from "#lib/mime";
import stream from "#lib/stream";
import StreamMultipart from "#lib/stream/multipart";
import StreamSlice from "#lib/stream/slice";

const COMPRESSORS = {
    "gzip": createGzip,
    "br": createBrotliCompress,
    "deflate": createDeflate,
};

export default class HttpMessage {
    #status;
    #headers;
    #body;
    #isDestroyed = false;
    #isStream = false;
    #maxRanges;
    #ranges;

    constructor ( { status, headers, body, encoding } = {} ) {
        this.#setStatus( status || 200 );
        this.#headers = new Headers( headers );
        this.#setBody( body, encoding );
    }

    // static
    static new ( options ) {
        if ( options instanceof this ) {
            return options;
        }
        else {
            return new this( options );
        }
    }

    // properties
    get status () {
        return this.#status;
    }

    get headers () {
        return this.#headers;
    }

    get body () {
        return this.#body;
    }

    get hasBody () {
        return this.#body != null;
    }

    get isDestroyed () {
        return this.#isDestroyed;
    }

    get contentLength () {
        return this.#headers.contentLength;
    }

    get contentType () {
        return this.#headers.contentType;
    }

    // XXX
    get isStream () {
        return this.#isStream;
    }

    get maxRanges () {
        return this.#maxRanges;
    }

    get rangesSupported () {
        return this.#maxRanges !== 0;
    }

    get multiRangesSupported () {
        return this.rangesSupported && this.#maxRanges !== 1;
    }

    [ Symbol.for( "nodejs.util.inspect.custom" ) ] ( depth, options, inspect ) {
        const spec = {
            "status": this.#status,
            "hasBody": this.hasBody,
        };

        return "HttpBody: " + inspect( spec );
    }

    // public
    // XXX
    getBody () {

        // XXX
        this.#checkRange();
        console.log( this.#ranges );

        return this.#getBody();
    }

    destroy () {
        if ( !this.#isDestroyed ) {
            this.#isDestroyed = true;

            this.#deleteBody();
        }

        return this;
    }

    // XXX
    addRanges ( ranges ) {
        if ( this.hasBody ) {

            // XXX if 206 - wrap to multipart

            if ( this.status === 200 ) {

                // XXX
            }
        }

        return this;
    }

    // XXX
    addContentEncoding ( { minContentLength, acceptEncoding, zlibOptions } = {} ) {
        COMPRESS: if ( this.hasBody && !this.#headers.get( "content-encoding" ) ) {

            // check min. content length
            if ( minContentLength && this.#headers.contentLength < minContentLength ) break COMPRESS;

            const mimeType = mime.get( this.#headers.get( "content-type" ) );

            // mime type is not compressible
            if ( mimeType && !mimeType.compressible ) break COMPRESS;

            for ( const encoding of acceptEncoding ) {
                const compressor = COMPRESSORS[ encoding ];

                if ( compressor ) {

                    //                 // prepare compressed body stream
                    //                 if ( !methodIsHead ) {
                    //                     // convert body to stream
                    //                     if ( !( body instanceof stream.Readable ) ) {
                    //                         body = stream.Readable.from( body, { "objectMode": false } );
                    //                     }
                    //                     // pipe body to zlib compressor
                    //                     body = stream.pipeline( body, compressor( zlibOptions ), e => {} );
                    //                 }
                    //                 contentLength = null;
                    //                 this.#headers.set( "content-encoding", encoding );
                    //                 this.#headers.add( "vary", "accept-encoding" );
                    //                 break;
                }
            }
        }

        return this;
    }

    // private
    #setStatus ( status ) {
        this.#status = status;
    }

    #deleteBody () {
        if ( this.#body instanceof stream.Stream ) {
            this.#body.destroy();
        }

        this.#body = null;

        this.#headers.set( "content-length", null );
        this.#headers.delete( "content-type" );
        this.#headers.delete( "content-encoding" );
    }

    // XXX if !content-length - delete body
    #setBody ( body, encoding ) {
        var contentLength,
            contentType = this.#headers.get( "content-type" );

        if ( body != null ) {

            // URLSearchParams
            if ( body instanceof URLSearchParams ) {
                body = body.toString();

                contentType ??= "application/x-www-form-urlencoded; charset=UTF-8";
            }

            // string
            if ( typeof body === "string" ) {
                body = Buffer.from( body, encoding );
            }

            // Buffer
            if ( Buffer.isBuffer( body ) ) {
                contentLength = body.length;
            }

            // File
            else if ( body instanceof File ) {
                contentLength = body.size;
                this.#isStream = true;

                if ( body.type ) contentType ??= body.type;
            }

            // Blob
            else if ( body instanceof Blob ) {
                contentLength = body.size;
                this.#isStream = false;

                if ( body.type ) contentType ??= body.type;
            }

            // Stream
            else if ( body instanceof stream.Readable ) {
                contentLength = body.size;
                this.#isStream = true;

                if ( contentLength == null ) {
                    this.#maxRanges = 0;
                }
                else {
                    this.#maxRanges = 1;
                }

                // StreamMultipart
                if ( body instanceof StreamMultipart ) {
                    contentType = body.type;
                }
                else if ( body.type ) {
                    contentType ??= body.type;
                }
            }

            // unsupported body type
            else {
                this.#setStatus( 500 );
                body = null;
            }
        }

        if ( body == null ) {
            this.#body = null;

            this.#headers.delete( [

                //
                "content-length",
                "content-type",
                "content-range",
                "content-encoding",
                "transfer-encoding",
            ] );
        }
        else {
            this.#body = body;

            this.#headers.set( {
                "content-type": contentType,
            } );

            if ( contentLength == null ) {
                this.#headers.delete( "content-length" );

                this.#headers.set( "transfer-encoding", "chunked" );
            }
            else {
                this.#headers.set( {
                    "content-length": contentLength,
                } );

                this.#headers.delete( "transfer-encoding" );
            }
        }
    }

    #getBody ( range ) {
        var body = this.#body;

        // Buffer
        if ( Buffer.isBuffer( body ) ) {
            if ( range ) {
                range = range.calculateRange( body.length );

                body = body.subarray( range.start, range.end );
            }
        }

        // File
        else if ( this.#body instanceof File ) {
            body = body.stream( {
                "start": range?.start,
                "end": range?.end,
            } );
        }

        // Blob
        else if ( this.#body instanceof Blob ) {
            if ( range ) {
                body = body.slice( range.start, range.end );
            }
            else {
                body = body.buffer();
            }
        }

        // Stream
        else if ( this.#body instanceof stream.Readable ) {
            if ( range ) {
                body = StreamSlice.slice( body, { "start": range.start, "end": range.end } );
            }
        }

        return body;
    }

    // XXX
    #checkRange ( maxRanges, ranges ) {

        // ranges are not supported for this data type
        if ( !this.rangesSupported ) {
            return result( 200, {
                "headers": {
                    "accept-ranges": "none",
                },
            } );
        }

        // ranges are not allowed
        else if ( maxRanges === 0 ) {
            return result( 200, {
                "headers": {
                    "accept-ranges": "none",
                    "content-length": this.contentLength,
                },
            } );
        }

        // max. ranges limit
        else if ( maxRanges && maxRanges > ranges.length ) {
            return result( 416, {
                "headers": {
                    "accept-ranges": "bytes",
                    "content-range": `bytes */${ this.contentLength }`,
                },
            } );
        }

        // multiple ranges are not supported for this data type
        else if ( ranges.length > 1 && !this.multiRangesSupported ) {
            return result( 416, {
                "headers": {
                    "accept-ranges": "bytes",
                    "content-range": `bytes */${ this.contentLength }`,
                },
            } );
        }

        // validate ranges
        else {
            const ranges = [];

            for ( const range of ranges ) {
                const res = range.calculateHttpRange( this.contentLength );

                // range is not valid
                if ( !res.ok ) return res;

                ranges.push( {
                    range,
                    "headers": res.data.headers,
                } );
            }

            this.#ranges = ranges;

            // XXX
            return result( 200 );
        }
    }
}
