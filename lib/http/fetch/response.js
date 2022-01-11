import "#lib/result";
import stream from "#lib/stream";
import Headers from "#lib/http/fetch/headers";
import http from "node:http";
import zlib from "node:zlib";

export default class Response extends result.Result {
    #response;
    #signal;
    #body;
    #bodyUsed = false;
    #rawHeaders;
    #headers;
    #redirected;
    #trailers;
    #type;
    #url;

    constructor ( response, url, options = {} ) {
        if ( response instanceof http.IncomingMessage ) {
            super( [response.statusCode, response.statusMessage] );

            this.#response = response;
            this.#rawHeaders = this.#response.headers;

            // body
            const onEnd = () => {
                this.#bodyUsed = true;

                if ( !this.#response.complete && ( !this.#signal || !this.#signal.aborted ) ) {
                    throw `The connection was terminated while the message was still being sent`;
                }
            };

            const encoding = this.#rawHeaders["content-encoding"];

            if ( encoding === "gzip" || encoding === "x-gzip" ) {
                this.#body = stream.pipeline( this.#response,
                    zlib.createGunzip( {
                        "flush": zlib.Z_SYNC_FLUSH,
                        "finishFlush": zlib.Z_SYNC_FLUSH,
                    } ),
                    onEnd );
            }
            else if ( encoding === "deflate" || encoding === "x-deflate" ) {
                this.#body = stream.pipeline( this.#response, zlib.createInflate(), onEnd );
            }
            else if ( encoding === "br" ) {
                this.#body = stream.pipeline( this.#response, zlib.createBrotliDecompress(), onEnd );
            }
            else {
                this.#body = stream.pipeline( this.#response, new stream.PassThrough(), onEnd );
            }
        }
        else {
            super( response );

            this.#rawHeaders = options.headers;
        }

        this.#url = url;
        this.#type = options.type || "basic";
        this.#redirected = options.redirected ?? false;
        this.#signal = options.signal;
    }

    // static
    static error ( res ) {
        return new this( res || result( [500, `Network error`] ), null, { "type": "error" } );
    }

    static redirect ( url, status ) {
        return new this( result( status ), null, { "headers": { "location": new URL( url ).toString() } } );
    }

    // properties
    get body () {
        return this.#body;
    }

    get bodyUsed () {
        return this.#bodyUsed;
    }

    get headers () {
        this.#headers ??= new Headers( this.#rawHeaders );

        return this.#headers;
    }

    get redirected () {
        return this.#redirected;
    }

    // XXX return promise, populated after end event
    get trailers () {
        return null;

        // this.#trailers ??= new Headers( this.#response.trailers );

        // return this.#trailers;
    }

    get type () {
        return this.#type;
    }

    get url () {
        return this.#url;
    }

    // public
    async arrayBuffer () {
        return this.body?.arrayBuffer();
    }

    async blob () {
        return this.body?.blob();
    }

    async buffer () {
        return this.body?.buffer();
    }

    // XXX
    clone () {
        throw `Not implemented`;
    }

    // XXX
    async formData () {
        throw `Not implemented`;
    }

    async json () {
        return this.body?.json();
    }

    async text () {
        return this.body?.text();
    }
}
