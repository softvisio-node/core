import fetch from "#lib/fetch";

const VERSION = "v1",
    ID = "open-ai",
    MODELS = {
        "text-embedding-3-small": {
            "embeddingSize": 1536,
        },
        "text-embedding-3-large": {
            "embeddingSize": 3072,
        },
    };

export default class OperAiApi {
    #apiKey;

    constructor ( apiKey ) {
        this.#apiKey = apiKey;
    }

    // static
    static get id () {
        return ID;
    }

    static get models () {
        return MODELS;
    }

    // properties
    get id () {
        return this.constructor.id;
    }

    get models () {
        return this.constructor.models;
    }

    // public
    // XXX simple
    // https://platform.openai.com/docs/api-reference/embeddings/create
    async getEmbedding ( model, data, { simple } = {} ) {
        var body;

        if ( typeof data === "string" ) {
            body = {
                model,
                "input": data,
            };
        }
        else {
            body = {
                ...data,
                model,
            };
        }

        return this.#doRequest( "embeddings", { body } );
    }

    // private
    async #doRequest ( path, { method, params, body } = {} ) {
        const url = new URL( `https://api.openai.com/${ VERSION }/${ path }` );

        if ( params ) {
            const urlSearchParams = new URLSearchParams( params );

            url.search = urlSearchParams;
        }

        const headers = {
            "Authorization": `Bearer ${ this.#apiKey }`,
        };

        if ( body ) {
            method ||= "post";

            headers[ "Content-Type" ] = "application/json";

            body = JSON.stringify( body );
        }

        const res = await fetch( url, {
            method,
            headers,
            body,
        } );

        const data = await res.json().catch( e => null );

        if ( !res.ok ) {
            return result( [ res.status, data?.error?.message ] );
        }

        return result( 200, data );
    }
}
