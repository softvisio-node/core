import DoublyLinkedList from "#lib/data/doubly-linked-list";

export default class Queue {
    #list;

    constructor () {
        this.#list = new DoublyLinkedList();
    }

    // properties
    get length () {
        return this.#list.length;
    }

    // public
    push ( ...values ) {
        for ( const value of values ) {
            this.#list.push( value );
        }
    }

    shift () {
        return this.#list.shift()?.value;
    }

    clear () {
        return this.#list.clear();
    }

    *[Symbol.iterator] () {
        for ( const entry of this.#list[Symbol.iterator]() ) {
            yield entry.value;
        }
    }

    *reverse () {
        for ( const entry of this.#list.reverse() ) {
            yield entry.value;
        }
    }
}
