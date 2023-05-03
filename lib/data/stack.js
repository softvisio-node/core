const DEFAULT_BLOCK_SIZE = 1024;

export default class Stack {
    #blockSize;
    #array = new Array( 0 );
    #blocks = 0;
    #length = 0;

    constructor ( blockSize ) {
        this.#blockSize = blockSize || DEFAULT_BLOCK_SIZE;
    }

    // properties
    get length () {
        return this.#length;
    }

    // public
    push ( ...values ) {
        if ( this.#length + values.length > this.#array.length ) {
            const freeLength = this.#array.length - this.#length,
                lengthToAdd = values.length - freeLength;

            this.#blocks += Math.ceil( lengthToAdd / this.#blockSize );

            this.#array.length = this.#blockSize * this.#blocks;
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

        this.#freeMemory();

        return value;
    }

    clear () {
        if ( !this.#blocks ) return;

        this.#length = 0;
        this.#blocks = 0;

        this.#array = new Array( 0 );
    }

    // private
    #freeMemory () {
        if ( this.#blocks === 1 ) {
            return;
        }
        else {
            const freeBlocks = ( this.#array.length - this.#length ) / this.#blockSize;

            if ( freeBlocks > 1.5 ) {
                this.#blocks = Math.floor( freeBlocks );

                this.#array.length = this.#blockSize * this.#blocks;
            }
        }
    }
}
