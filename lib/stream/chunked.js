import stream from "#lib/stream";

const EOL = "\r\n",
    MAX_CHUNK_LENGTH = Number.MAX_SAFE_INTEGER,
    STATES = {
        "length": 1,
        "chunk": 2,
        "lastChunk": 3,
        "done": 4,
    };

export class ChunkedStreamEncoder extends stream.Transform {
    #eol;

    constructor ( { eol } = {} ) {
        super();

        this.#eol = eol || EOL;
        if ( !Buffer.isBuffer( this.#eol ) ) this.#eol = Buffer.from( this.#eol );
    }

    // properties
    get eol () {
        return this.#eol;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        this.push( Buffer.from( chunk.length.toString( 16 ) ) );
        this.push( this.#eol );
        this.push( chunk );
        this.push( this.#eol );

        callback();
    }

    _flush ( callback ) {
        this.push( Buffer.from( "0" ) );
        this.push( this.#eol );
        this.push( this.#eol );

        callback();
    }
}

export class ChunkedStreamDecoder extends stream.Transform {
    #eol;
    #maxChunkLength;
    #chunkLengthSize;
    #buffer;
    #state = STATES.length;
    #chunkLength;

    constructor ( { eol, maxChunkLength } = {} ) {
        super();

        this.#eol = eol || EOL;
        if ( !Buffer.isBuffer( this.#eol ) ) this.#eol = Buffer.from( this.#eol );

        this.#maxChunkLength = maxChunkLength || MAX_CHUNK_LENGTH;

        this.#chunkLengthSize = this.#maxChunkLength.toString( 16 ).length + this.#eol.length;
    }

    // properties
    get eol () {
        return this.#eol;
    }

    get maxChunkLength () {
        return this.#maxChunkLength;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( !this.#buffer?.length ) {
            this.#buffer = chunk;
        }
        else {
            this.#buffer = Buffer.concat( [ this.#buffer, chunk ] );
        }

        while ( true ) {
            if ( !this.#buffer.length ) {
                return callback();
            }

            // done
            else if ( this.#state === STATES.done ) {
                return callback( "Chunked data is not valid" );
            }

            // length
            if ( this.#state === STATES.length ) {
                if ( this.#buffer.length <= this.#eol.length ) {
                    return callback();
                }
                else {
                    const idx = this.#buffer.subarray( 0, this.#chunkLengthSize ).indexOf( this.#eol );

                    if ( idx <= 0 ) {
                        return callback( "Chunk length is not valid" );
                    }
                    else {
                        const length = Number.parseInt( this.#buffer.subarray( 0, idx ).toString(), 16 );

                        if ( !Number.isInteger( length ) ) {
                            return callback( "Chunk length is not valid" );
                        }
                        else if ( length > this.#maxChunkLength ) {
                            return callback( "Chunk length is too large" );
                        }

                        this.#chunkLength = length;

                        this.#buffer = this.#buffer.subarray( idx + this.#eol.length );

                        if ( this.#chunkLength === 0 ) {
                            this.#state = STATES.lastChunk;
                        }
                        else {
                            this.#state = STATES.chunk;
                        }
                    }
                }
            }

            // chunk
            else {

                // read eol
                if ( this.#chunkLength === 0 ) {
                    if ( this.#buffer.length < this.#eol.length ) {
                        return callback();
                    }
                    else if ( this.#eol.equals( this.#buffer.subarray( 0, this.#eol.length ) ) ) {
                        this.#buffer = this.#buffer.subarray( this.#eol.length );

                        if ( this.#state === STATES.chunk ) {
                            this.#state = STATES.length;
                        }
                        else {
                            this.#state = STATES.done;
                        }
                    }
                    else {
                        return callback( "Chunked data is not valid" );
                    }
                }

                // read chunk body
                else {
                    const chunk = this.#buffer.subarray( 0, this.#chunkLength );

                    this.#buffer = this.#buffer.subarray( chunk.length );

                    this.#chunkLength -= chunk.length;

                    this.push( chunk );
                }
            }
        }
    }

    _flush ( callback ) {
        if ( this.#state === STATES.done ) {
            callback();
        }
        else {
            callback( "Chunked data is not valid" );
        }
    }
}
