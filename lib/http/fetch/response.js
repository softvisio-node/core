import "#lib/result";
import stream from "#lib/stream";
import Headers from "#lib/http/fetch/headers";
import http from "node:http";
import zlib from "node:zlib";
import Signal from "#lib/threads/signal";

export default class Response extends result.Result {
    #incomingMessage;
    #signal;
    #body;
    #rawHeaders;
    #headers;
    #redirected;
    #trailers;
    #trailiersSignal;
    #type;
    #url;
    #manualDestroy;

    constructor ( response, url, options = {} ) {
        if ( response instanceof http.IncomingMessage ) {
            super( [response.statusCode, response.statusMessage] );

            this.#incomingMessage = response;
            this.#rawHeaders = this.#incomingMessage.headers;

            // body
            const onEnd = () => {
                if ( this.#trailiersSignal ) {
                    this.#trailers = new Headers( this.#incomingMessage.trailers );

                    this.#trailiersSignal.broadcast( this.#trailers );

                    this.#trailiersSignal = null;
                }

                if ( !this.#incomingMessage.complete && !this.#manualDestroy && ( !this.#signal || !this.#signal.aborted ) ) {
                    throw `The connection was terminated while the message was still being sent`;
                }
            };

            const encoding = this.#rawHeaders["content-encoding"];

            if ( encoding === "gzip" || encoding === "x-gzip" ) {
                this.#body = stream.pipeline( this.#incomingMessage,
                    zlib.createGunzip( {
                        "flush": zlib.Z_SYNC_FLUSH,
                        "finishFlush": zlib.Z_SYNC_FLUSH,
                    } ),
                    onEnd );
            }
            else if ( encoding === "deflate" || encoding === "x-deflate" ) {
                this.#body = stream.pipeline( this.#incomingMessage, zlib.createInflate(), onEnd );
            }
            else if ( encoding === "br" ) {
                this.#body = stream.pipeline( this.#incomingMessage, zlib.createBrotliDecompress(), onEnd );
            }
            else {
                this.#body = stream.pipeline( this.#incomingMessage, new stream.PassThrough(), onEnd );
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
        return this.#incomingMessage ? this.#incomingMessage.complete : true;
    }

    get headers () {
        this.#headers ??= new Headers( this.#rawHeaders );

        return this.#headers;
    }

    get redirected () {
        return this.#redirected;
    }

    get trailers () {
        return new Promise( resolve => {
            if ( this.#trailers ) {
                resolve( this.#trailers );
            }
            else if ( this.#incomingMessage ) {
                if ( this.#incomingMessage.complete ) {
                    this.#trailers = new Headers( this.#incomingMessage.trailers );

                    resolve( this.#trailers );
                }
                else {
                    this.#trailiersSignal ??= new Signal();

                    resolve( this.#trailiersSignal.wait() );
                }
            }
            else {
                this.#trailers = new Headers();

                resolve( this.#trailers );
            }
        } );
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

    destroy ( error ) {
        this.#manualDestroy = true;

        this.#incomingMessage?.destroy( error );
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
