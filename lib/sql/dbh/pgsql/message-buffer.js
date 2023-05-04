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
}
