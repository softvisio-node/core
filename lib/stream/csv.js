import Csv from "#lib/csv";
import stream from "#lib/stream";

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

            callback();
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

        this.#csv = new Csv( { header, headerRpw } );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        try {
            const rows = this.#csv.parse( chunk, { encoding } );

            for ( const row of rows ) {
                this.push( row );
            }

            callback();
        }
        catch ( e ) {
            callback( e );
        }
    }
}
