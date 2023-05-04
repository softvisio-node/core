/* eslint-disable @softvisio/camelcase */

const DEFAULT_SIZE = 8192;

export default class DynamicBuffer {
    #size;
    #buffer;
    #pos = 0;

    constructor ( size ) {
        this.#size = size || DEFAULT_SIZE;
    }

    // properties
    get buffer () {
        return this.#buffer;
    }

    get length () {
        return this.#pos;
    }

    // public
    write ( value ) {

        // buffer
        if ( Buffer.isBuffer( value ) ) {
            const length = value.length;

            this.#fit( length );

            value.copy( this.#buffer, this.#pos );

            this.#pos += length;
        }

        // string
        else {
            const length = Buffer.byteLength( value );

            this.#fit( length );

            this.#buffer.write( value, this.#pos );

            this.#pos += length;
        }

        return this;
    }

    writeZ () {
        return this.writeInt8( 0 );
    }

    writeInt8 ( value ) {
        this.#fit( 1 );

        this.#buffer.writeInt8( value, this.#pos );

        this.#pos += 1;

        return this;
    }

    writeUInt16BE ( value ) {
        this.#fit( 2 );

        this.#buffer.writeUInt16BE( value, this.#pos );

        this.#pos += 2;

        return this;
    }

    writeInt32BE ( value ) {
        this.#fit( 4 );

        this.#buffer.writeInt32BE( value, this.#pos );

        this.#pos += 4;

        return this;
    }

    writeUInt32BE ( value ) {
        this.#fit( 4 );

        this.#buffer.writeUInt32BE( value, this.#pos );

        this.#pos += 4;

        return this;
    }

    done () {
        var buffer;

        if ( this.#buffer.length > this.#size ) {
            buffer = this.#buffer.subarray( 0, this.#pos );

            this.#buffer = Buffer.allocUnsafe( this.#size );
        }
        else {
            buffer = Buffer.allocUnsafe( this.#pos );

            this.#buffer.copy( buffer, 0, 0, this.#pos );
        }

        this.#pos = 0;

        return buffer;
    }

    // private
    #fit ( size ) {
        if ( !this.#buffer ) {
            this.#buffer = Buffer.allocUnsafe( size <= this.#size ? this.#size : this.#size + size );
        }
        else if ( this.#pos + size > this.#buffer.length ) {
            const old = this.#buffer;

            this.#buffer = Buffer.allocUnsafe( old.length * 2 + size );

            old.copy( this.#buffer );
        }
    }
}
