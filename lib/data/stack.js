const DEFAULT_BLOCK_SIZE = 1024;

export default class Stack {
    #array;
    #blockSize;
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
        if ( !this.#blocks ) this.#init();

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

        this.#truncate();

        return value;
    }

    clear () {
        if ( !this.#length ) return;

        this.#length = 0;
        this.#blocks = 1;

        this.#array = new Array( this.#blockSize * this.#blocks );
    }

    // private
    #init () {
        if ( this.#blocks ) return;

        this.#blocks = 1;

        this.#array = new Array( this.#blockSize * this.#blocks );
    }

    #truncate () {
        if ( this.#blocks === 1 ) return;

        // const freeLength = this.#array.length - this.#length;

        if ( this.#array.length - this.#length > this.#blockSize * 2 ) {
            this.#array.length = this.#length + this.#blockSize;

            console.log( "---", this.length, this.size );
        }
    }
}
