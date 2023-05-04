/* eslint-disable @softvisio/camelcase */

const DEFAULT_BLOCK_SIZE = 1024;

export default class MessageBuffer {
    #blockSize;
    #buffer;
    #pos = 0;

    constructor ( blockSize ) {
        this.#blockSize = blockSize || DEFAULT_BLOCK_SIZE;
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

    writeNull ( n = 1 ) {
        if ( n === 1 ) {
            return this.writeInt8( 0 );
        }
        else {
            this.#fit( n );

            this.#buffer.fill( 0, this.#pos, ( this.#pos += n ) );

            return this;
        }
    }

    writeInt8 ( value ) {
        this.#fit( 1 );

        this.#buffer.writeInt8( value, this.#pos );

        this.#pos += 1;

        return this;
    }

    writeInt16BE ( value ) {
        this.#fit( 2 );

        this.#buffer.writeInt16BE( value, this.#pos );

        this.#pos += 2;

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

    writeBigInt64BE ( value ) {
        this.#fit( 8 );

        this.#buffer.writeBigInt64BE( value, this.#pos );

        this.#pos += 8;

        return this;
    }

    writeBigUInt64BE ( value ) {
        this.#fit( 8 );

        this.#buffer.writeBigUInt64BE( value, this.#pos );

        this.#pos += 8;

        return this;
    }

    done () {
        var buffer;

        if ( this.#buffer.length > this.#blockSize ) {
            buffer = this.#buffer.subarray( 0, this.#pos );

            this.#buffer = Buffer.allocUnsafe( this.#blockSize );
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
            this.#buffer = Buffer.allocUnsafe( Math.ceil( size / this.#blockSize ) * this.#blockSize );
        }
        else {
            const bytesToAdd = size - ( this.#buffer.length - this.#pos );

            if ( bytesToAdd > 0 ) {
                const old = this.#buffer;

                this.#buffer = Buffer.allocUnsafe( Math.ceil( ( this.#buffer.length + bytesToAdd ) / this.#blockSize ) * this.#blockSize );

                old.copy( this.#buffer );
            }
        }
    }
}
