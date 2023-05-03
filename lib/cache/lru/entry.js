import DoubleLinkedList from "#lib/data/doubly-linked-list";

export default class CacheLruEntry extends DoubleLinkedList.Entry {
    #key;
    #expires;

    constructor ( key, value, maxAge ) {
        super( value );

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
