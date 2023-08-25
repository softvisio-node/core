import stream from "#lib/stream";
import msgpack from "#lib/msgpack";

export class Decode extends stream.Transform {
    #buf;

    constructor () {
        super( { "objectMode": true } );
    }

    _transform ( data, encoding, callback ) {
        if ( !this.#buf ) this.#buf = data;
        else this.#buf = Buffer.concat( [this.#buf, data] );

        while ( 1 ) {
            try {
                const [msg, length] = msgpack.decodeStream( this.#buf );

                this.#buf = this.#buf.subarray( length );

                this.push( msg );

                // buffer is empty
                if ( !this.#buf.length ) break;
            }
            catch ( e ) {

                // data is incomplete
                break;
            }
        }

        callback();
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
