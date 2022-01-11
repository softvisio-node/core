import "#lib/result";
import "#lib/stream";
import Headers from "#lib/fetch/headers";
import http from "node:http";

// import zlib from "node:zlib";

// res.resume();

// res.once( "end", () => {

//     // XXX
//     // if ( !res.complete ) console.error( "The connection was terminated while the message was still being sent" );

//     // console.log( res.rawHeaders );

//     resolve( result( [res.statusCode, res.statusMessage] ) );
// } );

// XXX set bodyUsed

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
    // XXX
    get body () {
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
        return this.#response.arrayBuffer();
    }

    async blob () {
        return this.#response.blob();
    }

    clone () {
        throw `Not implemented`;
    }

    error () {
        throw `Not implemented`;
    }

    async formData () {
        throw `Not implemented`;
    }

    async json () {
        return this.#response.json();
    }

    redirect () {
        throw `Not implemented`;
    }

    async text () {
        return this.#response.text();
    }
}
