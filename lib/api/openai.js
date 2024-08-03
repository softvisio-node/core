import fetch from "#lib/fetch";

const VERSION = "v1";

export default class OperAiApi {
    #apiKey;

    constructor ( apiKey ) {
        this.#apiKey = apiKey;
    }

    // public
    // https://platform.openai.com/docs/api-reference/embeddings/create
    async getEmbeddings ( text, model ) {
        return this.#request( "embeddings", {
            "body": {
                "input": text,
                model,
            },
        } );
    }

    // private
    async #request ( path, { method, params, body } = {} ) {
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
