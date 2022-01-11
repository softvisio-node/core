import "#lib/result";
import stream from "#lib/stream";
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

            // body
            if ( this.#response.method !== "HEAD" && this.status !== 204 && this.status !== 304 ) {
                const onEnd = () => {
                    if ( !this.#response.complete ) throw `The connection was terminated while the message was still being sent`;
                };

                const encoding = this.#response.headers["content-encoding"];

                if ( encoding ) {
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
                }

                this.#body = stream.pipeline( this.#response, new stream.PassThrough(), onEnd );
            }
        }
        else {
            super( response );
        }

        this.#redirected = options.redirected;
    }

    // properties
    get body () {
        if ( this.#body ) {
            this.#bodyUsed = true;

            const body = this.#body;
            this.#body = null;

            return body;
        }
        else {
            return null;
        }
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

    // XXX return promise, populated after end event
    get trailers () {
        return null;

        // this.#trailers ??= new Headers( this.#response.trailers );

        // return this.#trailers;
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
