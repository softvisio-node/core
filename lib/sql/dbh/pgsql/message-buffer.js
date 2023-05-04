import DynamicBuffer from "#lib/data/dynamic-buffer";

export default class MessageBuffer extends DynamicBuffer {
    #msgPos = 0;

    // public
    beginMsg ( id ) {
        if ( id !== "" ) this.write( id );

        this.#msgPos = this.length;

        return this.writeUInt32BE( 0 );
    }

    endMsg () {
        this.buffer.writeUInt32BE( this.length - this.#msgPos, this.#msgPos );

        this.#msgPos = null;

        return this;
    }

    uint16 ( x ) {
        return this.writeUInt16BE( x );
    }

    int32 ( x ) {
        return this.writeInt32BE( x );
    }

    uint32 ( x ) {
        return this.writeUInt32BE( x );
    }

    buf ( value ) {
        return this.write( value );
    }

    zbuf ( value ) {
        this.write( value );

        return this.writeInt8( 0 );
    }

    z ( n ) {
        return this.write( "\0".repeat( n ) );
    }
}
