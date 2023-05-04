import MessageBuffer from "#lib/data/message-buffer";

export default class extends MessageBuffer {
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
