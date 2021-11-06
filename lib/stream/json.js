import stream from "stream";

const EOL = "\n";

export default class StreamJson extends stream.Transform {
    #buf = "";

    constructor () {
        super( { "objectMode": true } );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( Buffer.isBuffer( chunk ) ) chunk = chunk.toString();

        while ( 1 ) {
            const idx = chunk.indexOf( EOL );

            if ( idx === -1 ) {
                this.#buf += chunk;

                break;
            }
            else {
                this.#buf += chunk.substring( 0, idx );
                chunk = chunk.substr( idx + 1 );

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
