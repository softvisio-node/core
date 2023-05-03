const DEFAULT_SIZE = 8192;

export default class DynamicBuffer {
    #size;
    #buf;
    #pos = 0;
    #msgPos = 0;

    constructor ( size ) {
        this.#size = size || DEFAULT_SIZE;
    }

    // public
    uint16 ( x ) {
        this.#fit( 2 );

        this.#buf.writeUInt16BE( x, this.#pos );

        this.#pos += 2;

        return this;
    }

    int32 ( x ) {
        this.#fit( 4 );

        this.#buf.writeInt32BE( x, this.#pos );

        this.#pos += 4;

        return this;
    }

    uint32 ( x ) {
        this.#fit( 4 );

        this.#buf.writeUInt32BE( x, this.#pos );

        this.#pos += 4;

        return this;
    }

    buf ( value ) {

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

    zbuf ( value ) {

        // buffer
        if ( Buffer.isBuffer( value ) ) {
            const length = value.length + 1;

            this.#fit( length );

            value.copy( this.#buf, this.#pos );

            this.#pos += length;
        }

        // string
        else {
            const length = Buffer.byteLength( value ) + 1;

            this.#fit( length );

            this.#buf.write( value, this.#pos );

            this.#pos += length;
        }

        this.#buf.writeInt8( 0, this.#pos - 1 );

        return this;
    }

    z ( n ) {
        this.#fit( n );

        this.#buf.fill( 0, this.#pos, this.#pos + n );

        this.#pos += n;

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
