export default class DoublyLinkedListEntry {
    #value;
    #list;
    #prev;
    #next;

    constructor ( value ) {
        this.#value = value;
    }

    // properties
    get value () {
        return this.#value;
    }

    get list () {
        return this.#list;
    }

    set list ( list ) {
        this.#list = list;
    }

    get prev () {
        return this.#prev;
    }

    set prev ( entry ) {
        this.#prev = entry;
    }

    get next () {
        return this.#next;
    }

    set next ( entry ) {
        this.#next = entry;
    }

    get isFirst () {
        return !this.#prev;
    }

    get isLast () {
        return !this.#next;
    }

    // public
    delete () {
        this.#list?.deleteEntry( this );
    }
}
