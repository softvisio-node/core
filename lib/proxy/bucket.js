module.exports = class ProxyBucket {
    #key;
    #options;

    constructor ( key, options ) {
        this.#key = key;
        this.#options = options;
    }

    get key () {
        return this.#key;
    }

    get options () {
        return this.#options;
    }
};
