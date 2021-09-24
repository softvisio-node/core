export default class MessageBuffer {
    size = 1024;
    buf;
    pos = 0;
    msgPos = 0;

    constructor () {
        this.buf = Buffer.allocUnsafe( this.size );
    }

    add ( buf ) {
        this.fit( buf.length );

        buf.copy( this.buf, this.pos );

        this.pos += buf.length;

        return this;
    }

    beginMsg ( id ) {
        if ( id !== "" ) {
            this.fit( 5 );

            this.pos += this.buf.utf8Write( id, this.pos, 1 );
        }
        else {
            this.fit( 4 );
        }

        this.msgPos = this.pos;

        this.pos += 4;

        return this;
    }

    i16 ( x ) {
        this.fit( 2 );

        this.buf.writeInt16BE( x, this.pos );

        this.pos += 2;

        return this;
    }

    i32 ( x ) {
        this.fit( 4 );

        this.buf.writeInt32BE( x, this.pos );

        this.pos += 4;

        return this;
    }

    str ( x ) {
        const length = Buffer.byteLength( x );

        this.fit( length );

        this.pos += this.buf.utf8Write( x, this.pos, length );

        return this;
    }

    z ( n ) {
        this.fit( n );

        this.buf.fill( 0, this.pos, this.pos + n );

        this.pos += n;

        return this;
    }

    endMsg () {
        this.buf.writeInt32BE( this.pos - this.msgPos, this.msgPos );

        return this;
    }

    get () {
        var buf = this.buf.slice( 0, this.pos );

        this.buf = Buffer.allocUnsafe( this.size );

        this.pos = 0;

        return buf;
    }

    fit ( size ) {
        if ( this.pos + size > this.buf.length ) {
            const old = this.buf;

            this.buf = Buffer.allocUnsafe( old.length * 2 + size );

            old.copy( this.buf );
        }
    }
}
