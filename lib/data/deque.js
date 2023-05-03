import DoublyLinkedList from "#lib/data/doubly-linked-list";

export default class Deque {
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
        this.#list.push( ...values );
    }

    pop () {
        return this.#list.pop();
    }

    unshift ( ...values ) {
        this.#list.unshift( ...values );
    }

    shift () {
        return this.#list.shift();
    }

    clear () {
        return this.#list.clear();
    }

    [Symbol.iterator] () {
        return this.#list[Symbol.iterator]();
    }
}
