import stream from "#lib/stream";
import msgpack from "#lib/msgpack";

export class Decode extends stream.Transform {
    #buf;

    constructor () {
        super( { "objectMode": true } );
    }

    _transform ( data, encoding, callback ) {
        if ( !this.#buf ) {
            this.#buf = data;
        }
        else {
            this.#buf = Buffer.concat( [this.#buf, data] );
        }

        while ( 1 ) {
            try {
                const res = msgpack.decodeStream( this.#buf );

                // data is incomplete
                if ( !res ) {
                    callback( null );

                    return;
                }

                this.#buf = this.#buf.subarray( res[1] );

                this.push( res[0] );

                // buffer is empty
                if ( !this.#buf.length ) {
                    callback();

                    return;
                }
            }
            catch ( e ) {
                callback( e );

                return;
            }
        }
    }
}

export class Encode extends stream.Transform {
    constructor () {
        super( { "objectMode": true } );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        try {
            const data = msgpack.encode( chunk );

            this.push( data );

            callback( null );
        }
        catch ( e ) {
            callback( e );
        }
    }
}
