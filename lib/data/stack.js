const DEFAULT_SIZE = 1024;

export default class Stack {
    #array;
    #defaultSize;
    #size;
    #length;

    constructor ( size ) {
        this.#defaultSize = size || DEFAULT_SIZE;

        this.clear();
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

        this.#array[this.#length] = undefined;

        return value;
    }

    clear () {
        this.#size = this.#defaultSize;

        this.#array = new Array( this.#size );

        this.#length = 0;
    }
}
