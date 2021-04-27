module.exports = class ProxyBucket {
    #id;
    #options;
    #proxy;

    constructor ( id, options ) {
        this.#id = id;
        this.#options = options;
    }

    get id () {
        return this.#id;
    }

    get options () {
        return this.#options;
    }
};
