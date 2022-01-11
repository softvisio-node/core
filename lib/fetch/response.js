import "#lib/result";
import "#lib/stream";
import Headers from "#lib/fetch/headers";
import http from "http";

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

    constructor ( response ) {
        if ( response instanceof http.IncomingMessage ) {
            super( [response.statusCode, response.statusMessage] );

            this.#response = response;
        }
        else {
            super( response );
        }
    }

    // properties
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
