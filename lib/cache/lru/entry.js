export default class CacheLruEntry {
    #key;
    #value;
    #expires;

    constructor ( key, value, maxAge ) {
        this.#key = key;
        this.#value = value;

        if ( maxAge ) {
            this.#expires = new Date( Date.now() + maxAge );
        }
        else {
            this.#expires = false;
        }
    }

    // properties
    get key () {
        return this.#key;
    }

    get value () {
        return this.#value;
    }

    get isExpired () {
        return this.#expires && this.#expires < Date.now();
    }
}
