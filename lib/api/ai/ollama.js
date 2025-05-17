import Api from "#lib/api";

const ID = "ollama",
    MODELS = {
        "qwen3:0.6b": {
            "vectorDimensions": 1024,
        },
        "qwen3:1.7b": {
            "vectorDimensions": 2048,
        },
        "qwen3:4b": {
            "vectorDimensions": 2560,
        },
        "qwen3:8b": {
            "vectorDimensions": 4096,
        },
        "qwen3:14b": {
            "vectorDimensions": 5120,
        },
        "qwen3:30b": {
            "vectorDimensions": 5120,
        },
        "qwen3:32b": {
            "vectorDimensions": 5120,
        },
        "qwen3:235b": {
            "vectorDimensions": 4096,
        },
    };

const DEFAULT_API_URL = "ws://ollama:81/api";

export default class OllamaApi {
    #api;

    constructor ( apiUrl ) {
        this.#api = new Api( apiUrl || DEFAULT_API_URL );
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
    async getEmbeddings ( model, text, { raw, ...options } = {} ) {
        const res = await this.#api.call( "ollama/embed", {
            model,
            "input": text,
        } );

        if ( !res.ok ) return res;

        if ( !raw ) {
            res.data = res.data.embeddings[ 0 ];
        }

        return res;
    }

    async getCompletion ( model, text, { raw, ...options } = {} ) {
        const res = await this.#api.call( "ollama/generate", {
            model,
            "prompt": text,
        } );

        if ( !res.ok ) return res;

        const match = res.data.response.match( /<think>\n(.+)\n<\/think>\n(.*)/s );

        if ( raw ) {
            res.data.think = match[ 1 ].trim();
            res.data.response = match[ 2 ].trim();
        }
        else {
            res.data = match[ 2 ].trim();
        }

        return res;
    }

    async getVersion () {
        return this.#api.call( "ollama/version" );
    }

    async getInstalledModels () {
        return this.#api.call( "ollama/tags" );
    }

    async getModelInfo ( model, { verbose = false } = {} ) {
        return this.#api.call( "ollama/show", model, {
            verbose,
        } );
    }

    async getLoadedModels () {
        return this.#api.call( "ollama/ps" );
    }

    async installModel ( model ) {
        return this.#api.call( "ollama/pull", model );
    }

    async deleteModel ( model ) {
        return this.#api.call( "ollama/delete", model );
    }
}
