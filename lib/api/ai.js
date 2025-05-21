import GeminiApi from "./ai/gemini.js";
import OllamaApi from "./ai/ollama.js";
import OpenAiApi from "./ai/open-ai.js";

const PROVIDERS = {
        "ollama": OllamaApi,
        "gemini": GeminiApi,
        "openAi": OpenAiApi,
    },
    MODELS = {};

for ( const provider in PROVIDERS ) {
    for ( const model in PROVIDERS[ provider ].models ) {
        MODELS[ model ] = {
            ...PROVIDERS[ provider ].models[ model ],
            "id": model,
            provider,
        };
    }
}

export default class AiApi {
    #models = {};
    #providers = {
        "ollama": null,
        "gemini": null,
        "openAi": null,
    };

    constructor ( { ollama, gemini, openAi } = {} ) {
        if ( ollama ) this.#providers.ollama = new OllamaApi( ...ollama );
        if ( gemini ) this.#providers.gemini = new GeminiApi( ...gemini );
        if ( openAi ) this.#providers.openAi = new OpenAiApi( ...openAi );

        for ( const model in MODELS ) {
            if ( this[ MODELS[ model ].provider ] ) {
                this.#models[ model ] = MODELS[ model ];
            }
        }
    }

    // static
    static get models () {
        return MODELS;
    }

    // properties
    get models () {
        return this.#models;
    }

    get hasOllama () {
        return Boolean( this.#providers.ollama );
    }

    get hasGemini () {
        return Boolean( this.#providers.gemini );
    }

    get hasOpenAi () {
        return Boolean( this.#providers.openAi );
    }

    get ollama () {
        return this.#providers.ollama;
    }

    get gemini () {
        return this.#providers.gemini;
    }

    get openAi () {
        return this.#providers.openAi;
    }

    // public
    getApi ( model ) {
        return this.#providers[ this.#models[ model ].provider ];
    }

    async getEmbedding ( model, text ) {
        return this.getApi( model ).getEmbedding( model, text, { "simple": true } );
    }

    async getCompletion ( model, text ) {
        return this.getApi( model ).getCompletion( model, text, { "simple": true } );
    }

    async getChatCompletion ( model, text ) {
        return this.getApi( model ).getChatCompletion( model, text, { "simple": true } );
    }
}
