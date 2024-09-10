/* eslint-disable @softvisio/camel-case */

const DEFAULT_BLOCK_SIZE = 1024;

export default class MessageBuffer {
    #blockSize;
    #buffer;
    #length = 0;

    constructor ( blockSize ) {
        this.#blockSize = blockSize || DEFAULT_BLOCK_SIZE;
    }

    // properties
    get buffer () {
        return this.#buffer;
    }

    get length () {
        return this.#length;
    }

    // public
    write ( value ) {

        // buffer
        if ( Buffer.isBuffer( value ) ) {
            const length = value.length;

            this.#fit( length );

            value.copy( this.#buffer, this.#length );

            this.#length += length;
        }

        // string
        else {
            const length = Buffer.byteLength( value );

            this.#fit( length );

            this.#buffer.write( value, this.#length );

            this.#length += length;
        }

        return this;
    }

    writeNull ( n = 1 ) {
        if ( n === 1 ) {
            return this.writeInt8( 0 );
        }
        else {
            this.#fit( n );

            this.#buffer.fill( 0, this.#length, ( this.#length += n ) );

            return this;
        }
    }

    writeInt8 ( value ) {
        this.#fit( 1 );

        this.#buffer.writeInt8( value, this.#length );

        this.#length += 1;

        return this;
    }

    writeInt16BE ( value ) {
        this.#fit( 2 );

        this.#buffer.writeInt16BE( value, this.#length );

        this.#length += 2;

        return this;
    }

    writeUInt16BE ( value ) {
        this.#fit( 2 );

        this.#buffer.writeUInt16BE( value, this.#length );

        this.#length += 2;

        return this;
    }

    writeInt32BE ( value ) {
        this.#fit( 4 );

        this.#buffer.writeInt32BE( value, this.#length );

        this.#length += 4;

        return this;
    }

    writeUInt32BE ( value ) {
        this.#fit( 4 );

        this.#buffer.writeUInt32BE( value, this.#length );

        this.#length += 4;

        return this;
    }

    writeBigInt64BE ( value ) {
        this.#fit( 8 );

        this.#buffer.writeBigInt64BE( value, this.#length );

        this.#length += 8;

        return this;
    }

    writeBigUInt64BE ( value ) {
        this.#fit( 8 );

        this.#buffer.writeBigUInt64BE( value, this.#length );

        this.#length += 8;

        return this;
    }

    done () {
        var buffer;

        if ( this.#length > this.#blockSize ) {
            buffer = this.#buffer.subarray( 0, this.#length );

            this.#buffer = Buffer.allocUnsafe( this.#blockSize );
        }
        else {
            buffer = Buffer.allocUnsafe( this.#length );

            this.#buffer.copy( buffer, 0, 0, this.#length );
        }

        this.#length = 0;

        return buffer;
    }

    // private
    #fit ( size ) {
        if ( !this.#buffer ) {
            this.#buffer = Buffer.allocUnsafe( Math.ceil( size / this.#blockSize ) * this.#blockSize );
        }
        else {
            const bytesToAdd = size - ( this.#buffer.length - this.#length );

            if ( bytesToAdd > 0 ) {
                const old = this.#buffer;

                this.#buffer = Buffer.allocUnsafe( Math.ceil( ( this.#buffer.length + bytesToAdd ) / this.#blockSize ) * this.#blockSize );

                old.copy( this.#buffer );
            }
        }
    }
}
