import Blob from "#lib/blob";
import File from "#lib/file";
import stream from "#lib/stream";
import StreamMultipart from "#lib/stream/multipart";
import StreamSlice from "#lib/stream/slice";

export default class HttpBody {
    #body;
    #contentLength;
    #contentType;
    #isStream = false;
    #maxRanges;

    constructor ( body, { encoding, contentType } = {} ) {
        this.#body = body;

        this.#analyze( { encoding, contentType } );
    }

    // properties
    get contentLength () {
        return this.#contentLength;
    }

    get contentType () {
        return this.#contentType;
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

    // public
    getBody () {
        return this.#getBody();
    }

    // private
    #analyze ( { encoding, contentType } = {} ) {

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
            this.#contentLength = this.#body.length;
        }

        // File
        else if ( this.#body instanceof File ) {
            this.#contentLength = this.#body.size;
            this.#isStream = true;

            if ( this.#body.type ) contentType ??= this.#body.type;
        }

        // Blob
        else if ( this.#body instanceof Blob ) {
            this.#contentLength = this.#body.size;
            this.#isStream = false;

            if ( this.#body.type ) contentType ??= this.#body.type;
        }

        // Stream
        else if ( this.#body instanceof stream.Readable ) {
            this.#contentLength = this.#body.size;
            this.#isStream = true;

            if ( this.#contentLength == null ) {
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
            throw new Error( "Body type is not supported" );
        }

        this.#contentType = contentType;
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
}
