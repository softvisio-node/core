import stream from "#lib/stream";

const DEFAULT_EOL = "\n";

export class Stringify extends stream.Transform {
    #eol;

    constructor ( eol ) {
        super( { "objectMode": true } );

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

export class Parse extends stream.Transform {
    #eol;
    #buf = "";

    constructor ( eol ) {
        super( { "objectMode": true } );

        this.#eol = eol ?? DEFAULT_EOL;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( Buffer.isBuffer( chunk ) ) chunk = chunk.toString( encoding );

        while ( true ) {
            const idx = chunk.indexOf( this.#eol );

            // eol not found
            if ( idx === -1 ) {
                this.#buf += chunk;

                break;
            }

            // eol found
            else {
                this.#buf += chunk.slice( 0, idx );

                chunk = chunk.slice( idx + this.#eol.length );

                try {
                    const data = JSON.parse( this.#buf );

                    this.push( data );
                }
                catch ( e ) {
                    callback( e );

                    return;
                }

                this.#buf = "";
            }
        }

        callback();
    }
}
