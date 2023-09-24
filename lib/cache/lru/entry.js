import Duration from "#lib/utils/duration";

export default class CacheLruEntry {
    #key;
    #value;
    #expires;

    constructor ( key, value, maxAge ) {
        this.#key = key;
        this.#value = value;

        this.#expires = maxAge ? Duration.new( maxAge ).toDate() : false;
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
