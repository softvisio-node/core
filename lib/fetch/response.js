import "#lib/result";
import "#lib/stream";

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
        super( [response.statusCode, response.statusMessage] );

        this.#response = response;
    }

    // properties
    get body () {
        return this.#response;
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
