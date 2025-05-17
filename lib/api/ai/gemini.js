import fetch from "#lib/fetch";

const ID = "gemini",

    // DOCS: https://ai.google.dev/gemini-api/docs/models
    MODELS = {
        "gemini-2.5-flash-preview-04-17": {},
        "gemini-2.5-pro-preview-05-06": {},
        "gemini-2.0-flash": {},
        "gemini-2.0-flash-preview-image-generation": {},
        "gemini-2.0-flash-lite": {},
        "gemini-2.0-flash-live-001": {},
        "gemini-embedding-exp": {
            "vectorDimensions": 3072, // 768, 1536, 3072
        },
        "imagen-3.0-generate-002": {},
        "veo-2.0-generate-001": {},
    };

export default class OllamaApi {
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
    getEmbeddings ( model, text, { raw } = {} ) {
        return result( 500 );
    }

    async getCompletion ( model, text, { raw } = {} ) {
        const res = await this.#doRequest( model, "generateContent", {
            "safetySettings": [
                { "category": "HARM_CATEGORY_CIVIC_INTEGRITY", "threshold": "OFF" },
                { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF" },
                { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF" },
                { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF" },
                { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF" },
            ],
            "contents": [
                {
                    "parts": [
                        {
                            "text": text,
                        },
                    ],
                },
            ],
        } );

        return res;
    }

    async generateContent ( model, data ) {
        return this.#doRequest( model, "generateContent", {
            "safetySettings": [
                { "category": "HARM_CATEGORY_CIVIC_INTEGRITY", "threshold": "OFF" },
                { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF" },
                { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF" },
                { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF" },
                { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF" },
            ],
            ...data,
        } );
    }

    // private
    async #doRequest ( model, method, body ) {
        const res = await fetch( `https://generativelanguage.googleapis.com/v1beta/models/${ model }:${ method }?key=${ this.#apiKey }`, {
            "method": body
                ? "POST"
                : "GET",
            "headers": {
                "content-type": "application/json",
            },
            "body": body
                ? JSON.stringify( body )
                : undefined,
        } );

        if ( !res.ok ) return res;

        const data = await res.json();

        return result( 200, data );
    }
}
