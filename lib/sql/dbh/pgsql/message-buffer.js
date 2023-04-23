export default class MessageBuffer {
    #size = 1024;
    #buf;
    #pos = 0;
    #msgPos = 0;

    constructor () {
        this.#buf = Buffer.allocUnsafe( this.#size );
    }

    // public
    beginMsg ( id ) {
        if ( id !== "" ) {
            this.#fit( 5 );

            this.#pos += this.#buf.utf8Write( id, this.#pos, 1 );
        }
        else {
            this.#fit( 4 );
        }

        this.#msgPos = this.#pos;

        this.#pos += 4;

        return this;
    }

    ui16 ( x ) {
        this.#fit( 2 );

        this.#buf.writeUInt16BE( x, this.#pos );

        this.#pos += 2;

        return this;
    }

    i32 ( x ) {
        this.#fit( 4 );

        this.#buf.writeInt32BE( x, this.#pos );

        this.#pos += 4;

        return this;
    }

    ui32 ( x ) {
        this.#fit( 4 );

        this.#buf.writeUInt32BE( x, this.#pos );

        this.#pos += 4;

        return this;
    }

    buf ( value ) {
        if ( !Buffer.isBuffer( value ) ) value = Buffer.from( value );

        const length = value.length;

        this.#fit( length );

        value.copy( this.#buf, this.#pos );

        this.#pos += length;

        return this;
    }

    zbuf ( value ) {
        if ( !Buffer.isBuffer( value ) ) value = Buffer.from( value );

        const length = value.length + 1;

        this.#fit( length );

        value.copy( this.#buf, this.#pos );

        this.#pos += length;

        this.#buf.writeInt8( 0, this.#pos - 1 );

        return this;
    }

    z ( n ) {
        this.#fit( n );

        this.#buf.fill( 0, this.#pos, this.#pos + n );

        this.#pos += n;

        return this;
    }

    endMsg () {
        this.#buf.writeUInt32BE( this.#pos - this.#msgPos, this.#msgPos );

        return this;
    }

    done () {
        var buf = this.#buf.slice( 0, this.#pos );

        this.#buf = Buffer.allocUnsafe( this.#size );

        this.#pos = 0;

        return buf;
    }

    // private
    #fit ( size ) {
        if ( this.#pos + size > this.#buf.length ) {
            const old = this.#buf;

            this.#buf = Buffer.allocUnsafe( old.length * 2 + size );

            old.copy( this.#buf );
        }
    }
}
