import StreamingSplitter from "#lib/data-structures/streaming-splitter";
import stream from "#lib/stream";

const DEFAULT_EOL = "\n";

export class JsonStreamEncoder extends stream.Transform {
    #eol;

    constructor ( { eol } = {} ) {
        super( {
            "writableObjectMode": true,
        } );

        this.#eol = eol ?? DEFAULT_EOL;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        try {
            const json = JSON.stringify( chunk );

            this.push( json + this.#eol );

            callback();
        }
        catch ( e ) {
            callback( e );
        }
    }
}

export class JsonStreamDecoder extends stream.Transform {
    #streamingSplitter;
    #buffers = [];

    constructor ( { eol } = {} ) {
        super( {
            "readableObjectMode": true,
        } );

        this.#streamingSplitter = new StreamingSplitter( eol || DEFAULT_EOL );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        const data = this.#streamingSplitter.push( chunk );

        for ( const chunk of data ) {
            if ( chunk == null ) {
                if ( this.#buffers.length ) {
                    const buffer = Buffer.concat( this.#buffers );
                    this.#buffers = [];

                    try {
                        this.push( JSON.parse( buffer ) );
                    }
                    catch ( e ) {
                        return callback( e );
                    }
                }
            }
            else {
                this.#buffers.push( chunk );
            }
        }

        callback();
    }

    _flush ( callback ) {
        const data = this.#streamingSplitter.flush();

        if ( data.length || this.#buffers.length ) {
            callback( "JSON stream is not complete" );
        }
        else {
            callback();
        }
    }
}
