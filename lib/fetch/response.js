import "#lib/result";
import "#lib/stream";
import Headers from "#lib/fetch/headers";
import http from "node:http";
import zlib from "node:zlib";

export default class Response extends result.Result {
    #response;
    #body;
    #bodyUsed = false;
    #headers;
    #redirected;
    #trailers;
    #type;
    #url;

    constructor ( response, url, options = {} ) {
        if ( response instanceof http.IncomingMessage ) {
            super( [response.statusCode, response.statusMessage] );

            this.#response = response;
            this.#url = url;
        }
        else {
            super( response );
        }

        this.#redirected = options.redirected;
    }

    // properties
    get body () {
        if ( !this.#response ) return null;

        if ( this.#bodyUsed ) return null;

        if ( this.#response.method === "HEAD" || this.status === 204 || this.status === 304 ) return null;

        this.#bodyUsed = true;

        this.#response.once( "end", () => {
            if ( !this.#response.complete ) throw `The connection was terminated while the message was still being sent`;
        } );

        const encoding = this.#response.headers["content-encoding"];

        if ( encoding ) {
            if ( encoding === "gzip" || encoding === "x-gzip" ) {
                return this.#response.pipe( zlib.createGunzip( {
                    "flush": zlib.Z_SYNC_FLUSH,
                    "finishFlush": zlib.Z_SYNC_FLUSH,
                } ) );
            }
            else if ( encoding === "deflate" || encoding === "x-deflate" ) {
                return this.#response.pipe( zlib.createInflate() );
            }
            else if ( encoding === "br" ) {
                return this.#response.pipe( zlib.createBrotliDecompress() );
            }
        }

        return this.#response;
    }

    get bodyUsed () {
        return this.#bodyUsed;
    }

    get headers () {
        this.#headers ??= new Headers( this.#response.headers );

        return this.#headers;
    }

    get redirected () {
        return this.#redirected;
    }

    // XXX
    get trailers () {
        return null;
    }

    // XXX
    get type () {
        return null;
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

    // XXX make static
    error () {
        throw `Not implemented`;
    }

    // XXX
    async formData () {
        throw `Not implemented`;
    }

    async json () {
        return this.body?.json();
    }

    // XXX
    redirect () {
        throw `Not implemented`;
    }

    async text () {
        return this.body?.text();
    }
}
