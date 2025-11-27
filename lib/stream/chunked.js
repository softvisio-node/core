import stream from "#lib/stream";

const EOL = "\r\n";

export class Encode extends stream.Transform {
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

export class Decode extends stream.Transform {
    #eol;
    #maxChunkLength;
    #chunkLengthSize;
    #buffer;
    #chunkLength;

    constructor ( { eol, maxChunkLength } = {} ) {
        super();

        this.#eol = eol || EOL;
        if ( !Buffer.isBuffer( this.#eol ) ) this.#eol = Buffer.from( this.#eol );

        this.#maxChunkLength = maxChunkLength || Number.MAX_SAFE_INTEGER;

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

            // read chunk length
            if ( !this.#chunkLength ) {
                if ( this.#buffer.length < this.#chunkLengthSize ) {
                    return callback();
                }
                else {
                    const idx = this.#buffer.subarray( 0, this.#chunkLengthSize ).indexOf( this.#eol );

                    if ( idx <= 1 ) {
                        return callback( "Chunk length is not valid" );
                    }
                    else {
                        const length = Number( this.#buffer.subarray( 0, idx ).toString() );

                        if ( !Number.isInteger( length ) ) {
                            return callback( "Chunk length is not valid" );
                        }
                        else if ( length > this.#maxChunkLength ) {
                            return callback( "Chunk length is too large" );
                        }

                        this.#chunkLength = length;

                        this.#buffer = this.#buffer.subarray( 0, idx + this.#eol.length );

                        continue;
                    }
                }
            }

            // read chunk
            else {
                if ( this.#buffer.length >= this.#chunkLength ) {
                    this.push( this.#buffer.subarray( 0, this.#chunkLength ) );

                    this.#buffer = this.#buffer.subarray( this.#chunkLength + 1 );

                    this.#chunkLength = null;

                    continue;
                }
                else {
                    this.push( this.#buffer );

                    this.#chunkLength -= this.#buffer.length;

                    this.#buffer = null;

                    return callback();
                }
            }
        }
    }

    _flush ( callback ) {
        if ( this.#chunkLength || this.#buffer?.length ) {
            callback( "Chunked data is not complete" );
        }
        else {
            callback();
        }
    }
}
