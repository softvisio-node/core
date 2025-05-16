import OllamaApi from "./ai/ollama.js";
import OpenAiApi from "./ai/open-ai.js";
import VertexApi from "./ai/vertex.js";

const PROVIDERS = {
        "ollama": OllamaApi,
        "openAi": OpenAiApi,
        "vertex": VertexApi,
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
        "openAi": null,
        "vertex": null,
    };

    constructor ( { ollama, openAi, vertex } = {} ) {
        if ( ollama ) this.#providers.ollama = new OllamaApi( ollama );
        if ( openAi ) this.#providers.openAi = new OpenAiApi( openAi );
        if ( vertex ) this.#providers.vertex = new VertexApi( vertex );

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

    get ollama () {
        return this.#providers.ollama;
    }

    get openAi () {
        return this.#providers.openAi;
    }

    get vertex () {
        return this.#providers.vertex;
    }

    // public
    async getEmbeddings ( model, text, options ) {
        return this.#providers[ this.#models[ model ].provider ].getEmbeddings( text, model, options );
    }
}
