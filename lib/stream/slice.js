import Range from "#lib/range";
import stream from "#lib/stream";

export default class StreamSlice extends stream.Transform {
    #start;
    #length;
    #readLength = 0;
    #writeLength = 0;

    constructor ( { start, end, length, ...options } = {} ) {
        super( options );

        this.#start = start || 0;

        if ( end != null ) {
            this.#length = end - this.#start;
        }
        else if ( length != null ) {
            this.#length = length;
        }
    }

    // static
    static slice ( readableStream, { start, end, length } = {} ) {
        const sliceStream = new this( { start, end, length } );

        if ( readableStream.size != null ) {
            const range = new Range( { start, end, length } ).calculate( readableStream.size );

            if ( range ) {
                sliceStream.setSize( range.length );
            }
        }

        if ( readableStream.type ) {
            sliceStream.setType( readableStream.type );
        }

        return stream.pipeline( readableStream, sliceStream, e => {} );
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

        if ( this.#start && !this.#writeLength ) {
            if ( this.#readLength < this.#start ) {
                return callback();
            }
            else {
                chunk = chunk.subarray( this.#start - ( this.#readLength - chunk.length ) );
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
