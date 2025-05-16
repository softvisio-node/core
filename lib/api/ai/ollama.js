import Api from "#lib/api";

const ID = "ollama",
    MODELS = {
        "qwen3:4b": {
            "vectorDimensions": 2560,
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
    async getEmbeddings ( model, input ) {
        const res = await this.#api.call( "ollama/embed", {
            model,
            input,
        } );

        if ( !res.ok ) return res;

        res.data.embeddings = res.data.embeddings[ 0 ];

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
