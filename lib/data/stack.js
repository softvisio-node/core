export default class Stack {
    #list = [];

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

    clear () {
        this.#list = [];
    }

    [Symbol.iterator] () {
        return this.#list[Symbol.iterator]();
    }
}
