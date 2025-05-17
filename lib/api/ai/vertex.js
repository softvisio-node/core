const ID = "vertex",
    MODELS = {

        // english
        // "text-embedding-004": {
        //     "embeddingSize": 768,
        // },
        // multiligual
        // "text-multilingual-embedding-002": {
        //     "embeddingSize": 768,
        // },
    };

export default class OllamaApi {

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
    getEmbeddings ( model, text, { simple } = {} ) {
        return result( 500 );
    }
}
