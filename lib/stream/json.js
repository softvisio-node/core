import stream from "#lib/stream";

const DEFAULT_EOL = "\n";

export class Parse extends stream.Transform {
    #eol;
    #buf = "";

    constructor ( eol ) {
        super( { "objectMode": true } );

        this.#eol = eol ?? DEFAULT_EOL;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( Buffer.isBuffer( chunk ) ) chunk = chunk.toString();

        while ( 1 ) {
            const idx = chunk.indexOf( this.#eol );

            // eol not found
            if ( idx === -1 ) {
                this.#buf += chunk;

                break;
            }

            // eol found
            else {
                this.#buf += chunk.substring( 0, idx );

                chunk = chunk.substring( idx + this.#eol.length );

                try {
                    const data = JSON.parse( this.#buf );

                    this.push( data );
                }
                catch ( e ) {
                    callback( `Invalid JSON` );

                    return;
                }

                this.#buf = "";
            }
        }

        callback( null );
    }
}

export class Stringify extends stream.Transform {
    #eol;
    #buf = "";

    constructor ( eol ) {
        super( { "objectMode": true } );

        this.#eol = eol ?? DEFAULT_EOL;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        try {
            const json = JSON.stringify( chunk );

            this.push( json + "\n" );

            callback( null );
        }
        catch ( e ) {
            callback( e );
        }
    }
}
