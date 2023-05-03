const DEFAULT_SIZE = 1024;

export default class Stack {
    #array;
    #defaultSize;
    #length;

    constructor ( size ) {
        this.#defaultSize = size || DEFAULT_SIZE;

        this.clear();
    }

    // properties
    get length () {
        return this.#length;
    }

    // public
    push ( ...values ) {
        if ( this.#length + values.length > this.#array.length ) {
            this.#array.length += Math.ceil( ( values.length - this.#array.length - this.#length ) / this.#defaultSize ) * this.#defaultSize;
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

        this.#truncate();

        return value;
    }

    clear () {
        this.#array = new Array( this.#defaultSize );

        this.#length = 0;
    }

    // private
    #truncate () {
        if ( this.#array.length - this.#length > this.#defaultSize * 2 ) {
            this.#array.length = this.#length + this.#defaultSize;

            console.log( "---", this.length, this.size );
        }
    }
}
