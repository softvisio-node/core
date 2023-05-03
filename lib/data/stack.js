const DEFAULT_SIZE = 1024;

export default class Stack {
    #array;
    #defaultSize;
    #size;
    #length = 0;

    constructor ( size ) {
        this.#defaultSize = this.#size = size || DEFAULT_SIZE;
        this.#array = new Array( this.#size );
    }

    // properties
    get length () {
        return this.#length;
    }

    get size () {
        return this.#size;
    }

    // public
    push ( ...values ) {
        if ( this.#length + values.length > this.#size ) {
            this.#size = this.#size + this.#defaultSize + values.length;

            this.#array.length = this.#size;
        }

        for ( const value of values ) {
            this.#array[this.#length] = value;

            this.#length++;
        }
    }

    pop () {
        if ( !this.#length ) return;

        const value = this.#array[--this.#length];

        return value;
    }
}
