const MODELS = {

    // google english
    "text-embedding-004": {
        "provider": "google",
        "vectorDimensions": 768,
    },

    // google multiligual
    "text-multilingual-embedding-002": {
        "provider": "google",
        "vectorDimensions": 768,
    },

    // openai
    "text-embedding-3-small": {
        "provider": "openai",
        "vectorDimensions": 1536,
    },
    "text-embedding-3-large": {
        "provider": "openai",
        "vectorDimensions": 3072,
    },

    // ollama
    "qwen3:4b": {
        "provider": "ollama",
        "vectorDimensions": 2560,
    },
};

export default class AiApi {
    constructor () {}

    // properties
    get models () {
        return MODELS;
    }
}
