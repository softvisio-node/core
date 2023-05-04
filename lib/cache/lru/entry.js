export default class CacheLruEntry {
    #key;
    #expires;

    constructor ( key, value, maxAge ) {
        this.#key = key;

        this.#expires = maxAge ? Date.now() + maxAge : false;
    }

    // properties
    get key () {
        return this.#key;
    }

    get isExpired () {
        return this.#expires && this.#expires < Date.now();
    }
}
