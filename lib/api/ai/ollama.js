import Api from "#lib/api";

const ID = "ollama",
    MODELS = {
        "qwen3:0.6b": {
            "embeddingSize": 1024,
        },
        "qwen3:1.7b": {
            "embeddingSize": 2048,
        },
        "qwen3:4b": {
            "embeddingSize": 2560,
        },
        "qwen3:8b": {
            "embeddingSize": 4096,
        },
        "qwen3:14b": {
            "embeddingSize": 5120,
        },
        "qwen3:30b": {
            "embeddingSize": 5120,
        },
        "qwen3:32b": {
            "embeddingSize": 5120,
        },
        "qwen3:235b": {
            "embeddingSize": 4096,
        },
        "deepseek-r1:1.5b": {
            "embeddingSize": 1536,
        },
        "deepseek-r1:7b": {
            "embeddingSize": 3584,
        },
        "deepseek-r1:8b": {
            "embeddingSize": 4096,
        },
        "deepseek-r1:14b": {
            "embeddingSize": 5120,
        },
        "deepseek-r1:32b": {
            "embeddingSize": 5120,
        },
        "deepseek-r1:70b": {
            "embeddingSize": 8192,
        },
        "deepseek-r1:671b": {
            "embeddingSize": 7168,
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
    async getEmbedding ( model, text, { simple, ...options } = {} ) {
        const res = await this.#api.call( "ollama/get-embedding", model, text, options );

        if ( !res.ok ) return res;

        if ( simple ) {
            res.data = res.data.embeddings[ 0 ];
        }

        return res;
    }

    async getCompletion ( model, text, { simple, ...options } = {} ) {
        const res = await this.#api.call( "ollama/get-completion", model, text, options );

        if ( !res.ok ) return res;

        const match = res.data.response.match( /<think>\n(.+)\n<\/think>\n(.*)/s );

        if ( simple ) {
            res.data = match[ 2 ].trim();
        }
        else {
            res.data.think = match[ 1 ].trim();
            res.data.response = match[ 2 ].trim();
        }

        return res;
    }

    async getChatCompletion ( model, text, { simple, ...options } = {} ) {
        if ( typeof text === "string" ) {
            text = [
                {
                    "role": "user",
                    "content": text,
                },
            ];
        }

        const res = await this.#api.call( "ollama/get-chat-completion", model, text, options );

        if ( !res.ok ) return res;

        const match = res.data.message.content.match( /<think>\n(.+)\n<\/think>\n(.*)/s );

        if ( simple ) {
            res.data = match[ 2 ].trim();
        }
        else {
            res.data.think = match[ 1 ].trim();
            res.data.message.content = match[ 2 ].trim();
        }

        return res;
    }

    async getVersion () {
        return this.#api.call( "ollama/get-version" );
    }

    async getModels () {
        return this.#api.call( "ollama/get-models" );
    }

    async getInstalledModels () {
        return this.#api.call( "ollama/get-installed-models" );
    }

    async getRunningModels () {
        return this.#api.call( "ollama/get-running-models" );
    }

    async getModelInfo ( model, { verbose = false } = {} ) {
        return this.#api.call( "ollama/get-model-info", model, {
            verbose,
        } );
    }

    async installModel ( model ) {
        return this.#api.call( "ollama/install-model", model );
    }

    async deleteModel ( model ) {
        return this.#api.call( "ollama/delete-model", model );
    }
}
