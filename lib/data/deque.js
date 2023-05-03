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
        this.#list.push( ...values );
    }

    unshift ( ...values ) {
        this.#list.unshift( ...values );
    }

    shift () {
        return this.#list.shift();
    }

    pop () {
        return this.#list.pop();
    }

    clear () {
        return this.#list.clear();
    }
}
