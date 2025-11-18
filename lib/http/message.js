import Blob from "#lib/blob";
import File from "#lib/file";
import Headers from "#lib/http/headers";
import stream from "#lib/stream";
import StreamMultipart from "#lib/stream/multipart";
import StreamSlice from "#lib/stream/slice";

export default class HttpMessage {
    #status;
    #headers;
    #body;
    #isDestroyed = false;
    #isStream = false;
    #maxRanges;
    #ranges;

    constructor ( { status, headers, body, encoding } = {} ) {
        this.#status = status || 200;
        this.#headers = new Headers( headers );
        this.#body = body;

        this.#analyze( encoding );
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

    get isDestroyed () {
        return this.#isDestroyed;
    }

    get contentLength () {
        return this.#headers.contentLength;
    }

    get contentType () {
        return this.#headers.contentType;
    }

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
    addRanges ( ranges ) {}

    // XXX
    addTransferEncoding () {}

    // private
    #setStatus ( status ) {
        this.#status = status;
    }

    #deleteBody () {
        if ( this.#body instanceof stream.Stream ) {
            this.#body.destroy();
        }

        this.#body = null;

        this.#headers.set( "content-length", 0 );
        this.#headers.delete( "content-type" );
    }

    #analyze ( encoding ) {
        if ( this.#body == null ) {
            this.#deleteBody();

            return;
        }

        var contentLength = 0,
            contentType = this.#headers.get( "content-type" );

        // URLSearchParams
        if ( this.#body instanceof URLSearchParams ) {
            this.#body = this.#body.toString();

            contentType ??= "application/x-www-form-urlencoded; charset=UTF-8";
        }

        // string
        if ( typeof this.#body === "string" ) {
            this.#body = Buffer.from( this.#body, encoding );
        }

        // Buffer
        if ( Buffer.isBuffer( this.#body ) ) {
            contentLength = this.#body.length;
        }

        // File
        else if ( this.#body instanceof File ) {
            contentLength = this.#body.size;
            this.#isStream = true;

            if ( this.#body.type ) contentType ??= this.#body.type;
        }

        // Blob
        else if ( this.#body instanceof Blob ) {
            contentLength = this.#body.size;
            this.#isStream = false;

            if ( this.#body.type ) contentType ??= this.#body.type;
        }

        // Stream
        else if ( this.#body instanceof stream.Readable ) {
            contentLength = this.#body.size;
            this.#isStream = true;

            if ( contentLength == null ) {
                this.#maxRanges = 0;
            }
            else {
                this.#maxRanges = 1;
            }

            // StreamMultipart
            if ( this.#body instanceof StreamMultipart ) {
                contentType = this.#body.type;
            }
            else if ( this.#body.type ) {
                contentType ??= this.#body.type;
            }
        }

        // unsupported body type
        else {
            this.#setStatus( 500 );
            this.#body = null;
        }

        this.#headers.set( {
            "content-length": contentLength,
            "content-type": contentType,
        } );
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
