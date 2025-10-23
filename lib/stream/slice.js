import stream from "#lib/stream";

export default class StreamSlice extends stream.Transform {
    #offset;
    #length;
    #readLength = 0;
    #writeLength = 0;

    constructor ( { offset, length, ...options } = {} ) {
        super( options );

        this.#offset = offset || 0;
        this.#length = length ?? null;
    }

    // properties
    get offset () {
        return this.#offset;
    }

    get length () {
        return this.#length;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( !Buffer.isBuffer( chunk ) ) {
            try {
                chunk = Buffer.from( chunk, encoding );
            }
            catch ( e ) {
                return callback( e );
            }
        }

        this.#readLength += chunk.length;

        if ( this.#offset && !this.#writeLength ) {
            if ( this.#readLength < this.#offset ) {
                return callback();
            }
            else {
                chunk = chunk.subarray( this.#offset - ( this.#readLength - chunk.length ) );
            }
        }

        if ( this.#length != null ) {
            const rest = this.#length - this.#writeLength;

            if ( rest <= 0 ) {
                return callback();
            }
            else if ( chunk.length > rest ) {
                chunk = chunk.subarray( 0, rest );
            }
        }

        if ( chunk.length ) {
            this.push( chunk );
            this.#writeLength += chunk.length;
        }

        callback();
    }

    _flush ( callback ) {
        callback();
    }
}
