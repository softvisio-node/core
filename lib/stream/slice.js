import Range from "#lib/range";
import stream from "#lib/stream";

export default class StreamSlice extends stream.Transform {
    #start;
    #length;
    #readLength = 0;
    #writeLength = 0;

    constructor ( { contentLength, start, end, length, ...options } = {} ) {
        super( options );

        const range = new Range( { start, end, length } ).calculateRange( contentLength );

        this.setSize( range.length );

        this.#start = range.start;
        this.#length = range.maxLength;
    }

    // static
    static slice ( readableStream, { start, end, length } = {} ) {
        const sliceStream = new this( {
            "contentLength": readableStream.size,
            start,
            end,
            length,
        } );

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
