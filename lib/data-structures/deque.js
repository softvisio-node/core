import List from "#lib/data-structures/list";

export default class Deque {
    #list;

    constructor () {
        this.#list = new List();
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

    pop () {
        return this.#list.pop()?.value;
    }

    unshift ( ...values ) {
        for ( const value of values ) {
            this.#list.unshift( value );
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
