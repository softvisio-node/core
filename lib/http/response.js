import "#lib/result";
import stream from "#lib/stream";
import Headers from "#lib/http/headers";
import http from "node:http";
import zlib from "node:zlib";
import Signal from "#lib/threads/signal";
import StreamFormData from "#lib/stream/form-data";

export default class Response extends result.Result {
    #incomingMessage;
    #body;
    #headers;
    #redirected;
    #trailers;
    #trailiersSignal;
    #type;
    #url;
    #cookies;
    #formData;

    constructor ( response, url, options = {}, type ) {
        if ( response instanceof http.IncomingMessage ) {
            super( [ response.statusCode, response.statusMessage ] );

            this.#incomingMessage = response;
            const headers = this.#incomingMessage.headers;

            // body
            const onEnd = () => {

                // process trailiers
                if ( this.#trailiersSignal ) {
                    this.#trailers = new Headers( this.#incomingMessage.trailers );

                    this.#trailiersSignal.broadcast( this.#trailers );

                    this.#trailiersSignal = null;
                }
            };

            const encoding = headers[ "content-encoding" ];

            if ( encoding === "gzip" || encoding === "x-gzip" ) {
                this.#body = stream.pipeline(
                    this.#incomingMessage,
                    zlib.createGunzip( {
                        "flush": zlib.Z_SYNC_FLUSH,
                        "finishFlush": zlib.Z_SYNC_FLUSH,
                    } ),
                    onEnd
                );
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

            this.#headers = new Headers( options.headers );
            this.#body = stream.Readable.from( options.body || "", { "objectMode": false } );
        }

        this.#url = url;
        this.#type = type || "basic";
        this.#redirected = options.redirected ?? false;
        this.#cookies = options.cookies;
    }

    // static
    static error ( res, url, options ) {
        return new this( res || result( [ 500, `Network error` ] ), url, options, "error" );
    }

    static redirect ( url, status ) {
        return new this( result( status ), null, { "headers": { "location": new URL( url ).toString() } } );
    }

    // properties
    get body () {
        return this.#body;
    }

    // XXX unclear
    get bodyUsed () {
        return this.#body.readableEnded;

        // return this.#incomingMessage ? this.#incomingMessage.complete : true;
    }

    get headers () {
        this.#headers ??= new Headers( this.#incomingMessage );

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

    get cookies () {
        return this.#cookies;
    }

    get formData () {
        if ( !this.#formData ) {
            this.#formData = new StreamFormData( this.headers.contentType?.boundary );

            stream.pipeline( this.body, this.#formData, () => {} );
        }

        return this.#formData;
    }

    // public
    async arrayBuffer ( { maxLength } = {} ) {
        return this.body.arrayBuffer( { maxLength } );
    }

    async blob ( { maxLength, type } = {} ) {
        return this.body.blob( { maxLength, "type": type || this.headers.get( "content-type" ) } );
    }

    async buffer ( { maxLength } = {} ) {
        return this.body.buffer( { maxLength } );
    }

    // XXX
    clone () {
        throw `Not implemented`;
    }

    destroy ( error ) {
        this.#incomingMessage?.destroy( error );
    }

    async json ( { maxLength } = {} ) {
        return this.body.json( { maxLength } );
    }

    async tmpFile ( options = {} ) {
        options.type ||= this.headers.get( "content-type" );

        return this.body.tmpFile( options );
    }

    async text ( { maxLength, encoding } = {} ) {
        return this.body.text( { maxLength, encoding } );
    }
}
