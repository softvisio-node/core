import stream from "#lib/stream";
import Csv from "#lib/csv";

export class Stringify extends stream.Transform {
    #csv;

    constructor ( { header, headerRpw } = {} ) {
        super( { "objectMode": true } );

        this.#csv = new Csv( { header, headerRpw } );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        try {
            const data = this.#csv.stringify( chunk );

            this.push( data );

            callback( null );
        }
        catch ( e ) {
            callback( e );
        }
    }
}

export class Parse extends stream.Transform {
    #csv;

    constructor ( { header, headerRpw } = {} ) {
        super( { "objectMode": true } );

        this.#csv = new Csv( { header, headerRpw, "stream": true } );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( Buffer.isBuffer( chunk ) ) chunk = chunk.toString( encoding );

        try {
            const rows = this.#csv.parse( chunk );

            for ( const row of rows ) {
                this.push( row );
            }

            callback( null );
        }
        catch ( e ) {
            callback( e );
        }
    }
}
