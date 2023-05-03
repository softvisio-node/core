const DEFAULT_SIZE = 8192;

export default class DynamicBuffer {
    #size;
    #buf;
    #pos = 0;

    constructor ( size ) {
        this.#size = size || DEFAULT_SIZE;
    }

    // public
    write ( value ) {

        // buffer
        if ( Buffer.isBuffer( value ) ) {
            const length = value.length;

            this.#fit( length );

            value.copy( this.#buf, this.#pos );

            this.#pos += length;
        }

        // string
        else {
            const length = Buffer.byteLength( value );

            this.#fit( length );

            this.#buf.write( value, this.#pos );

            this.#pos += length;
        }

        return this;
    }

    writeUInt16BE ( value ) {
        this.#fit( 2 );

        this.#buf.writeUInt16BE( value, this.#pos );

        this.#pos += 2;

        return this;
    }

    writeInt32BE ( value ) {
        this.#fit( 4 );

        this.#buf.writeInt32BE( value, this.#pos );

        this.#pos += 4;

        return this;
    }

    writeUInt32BE ( value ) {
        this.#fit( 4 );

        this.#buf.writeUInt32BE( value, this.#pos );

        this.#pos += 4;

        return this;
    }

    done () {
        const buf = Buffer.allocUnsafe( this.#pos );

        this.#buf.copy( buf, 0, 0, this.#pos );

        if ( this.#buf.length > this.#size ) {
            this.#buf = Buffer.allocUnsafe( this.#size );
        }

        this.#pos = 0;

        return buf;
    }

    // private
    // XXX
    #fit ( size ) {
        if ( !this.#buf ) {
            this.#buf = Buffer.allocUnsafe( size <= this.#size ? this.#size : this.#size + size );
        }
        else if ( this.#pos + size > this.#buf.length ) {
            const old = this.#buf;

            this.#buf = Buffer.allocUnsafe( old.length * 2 + size );

            old.copy( this.#buf );
        }
    }
}
