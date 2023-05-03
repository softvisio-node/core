export default class Stack {
    #array = [];

    // properties
    get length () {
        return this.#array.length;
    }

    // public
    push ( ...values ) {
        this.#array.push( ...values );
    }

    pop () {
        return this.#array.pop();
    }

    clear () {
        this.#array = [];
    }

    [Symbol.iterator] () {
        return this.#array[Symbol.iterator]();
    }
}
