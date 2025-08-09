import * as msgpack from "#lib/msgpack";
import stream from "#lib/stream";

export class Encode extends stream.Transform {
    constructor () {
        super( { "objectMode": true } );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        try {
            const data = msgpack.toMsgPack( chunk );

            this.push( data );

            callback();
        }
        catch ( e ) {
            callback( e );
        }
    }
}

export class Decode extends stream.Transform {
    #buf;
    #offset = 0;

    constructor () {
        super( { "objectMode": true } );
    }

    _transform ( data, encoding, callback ) {
        if ( !this.#buf ) {
            this.#buf = data;
        }
        else {
            this.#buf = Buffer.concat( [ this.#buf, data ] );
        }

        while ( true ) {
            try {
                const { value, offset } = msgpack.fromMsgPackStream( this.#buf, this.#offset ) || {};

                // data is incomplete
                if ( offset == null ) {

                    // remove processed data
                    if ( this.#offset ) {
                        this.#buf = this.#buf.subarray( this.#offset );
                        this.#offset = 0;
                    }

                    break;
                }

                this.push( value );

                this.#offset = offset;

                // all data processed
                if ( this.#offset === this.#buf.length ) {
                    this.#buf = null;
                    this.#offset = 0;
                    break;
                }
            }
            catch ( e ) {
                callback( e );

                return;
            }
        }

        callback();
    }
}
