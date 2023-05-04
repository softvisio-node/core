import DoublyLinkedListEntry from "#lib/data/doubly-linked-list/entry";

export default class CacheLruEntry extends DoublyLinkedListEntry {
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
