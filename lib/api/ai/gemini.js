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
        "gemini-embedding-exp-03-07": {
            "vectorDimensions": 3072, // 768, 1536, 3072
        },

        // english
        "text-embedding-004": {
            "vectorDimensions": 768,
        },

        // multiligual
        "text-multilingual-embedding-002": {
            "vectorDimensions": 768,
        },
        "imagen-3.0-generate-002": {},
        "veo-2.0-generate-001": {},
    },
    safetySettingsOff = [
        { "category": "HARM_CATEGORY_CIVIC_INTEGRITY", "threshold": "OFF" },
        { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "OFF" },
        { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "OFF" },
        { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "OFF" },
        { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "OFF" },
    ];

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
    async getEmbedding ( model, data, { simple } = {} ) {
        var body;

        if ( typeof data === "string" ) {
            body = {
                "model": "models/" + model,
                "content": {
                    "parts": [
                        {
                            "text": data,
                        },
                    ],
                },
            };
        }
        else {
            body = {
                ...data,
            };
        }

        const res = await this.#doRequest( model, "embedContent", body );

        if ( !res.ok ) return res;

        if ( simple ) {
            res.data = res.data.embedding.values;
        }

        return res;
    }

    // XXX simple
    async getCompletion ( model, data, { simple } = {} ) {
        var body;

        if ( typeof data === "string" ) {
            body = {
                "safetySettings": safetySettingsOff,
                "contents": [
                    {
                        "parts": [
                            {
                                "text": data,
                            },
                        ],
                    },
                ],
            };
        }
        else {
            body = {
                "safetySettings": safetySettingsOff,
                ...data,
            };
        }

        const res = await this.#doRequest( model, "generateContent", body );

        // XXX
        // console.log( "---", res.data.candidates[ 0 ].content.parts[ 0 ].text );

        return res;
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
