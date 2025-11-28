import stream from "#lib/stream";

export default class StreamJoiner extends stream.Transform {
    #streams = new Set();
    #stream;
    #callback;
    #readableListener = this.#onReadable.bind( this );
    #errorListener = this.#onError.bind( this );
    #closeListener = this.#onClose.bind( this );
    #dataWrote = false;

    constructor () {
        super( {
            "writableObjectMode": true,
            "writableHighWaterMark": 1,
        } );
    }

    // properties
    get dataWrote () {
        return this.#dataWrote;
    }

    // public
    write ( chunk, encoding, callback ) {
        if ( chunk instanceof stream.Readable ) {
            if ( this.writable ) {
                this.#streams.add( chunk );
            }
            else {
                chunk.destroy();
            }
        }

        super.write( chunk, encoding, callback );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        this.#dataWrote = true;

        if ( chunk instanceof stream.Readable ) {
            this.#callback = callback;

            this.#setStream( chunk );

            this.#read();
        }
        else {
            if ( typeof chunk === "string" ) {
                chunk = Buffer.from( chunk, encoding );
            }

            if ( Buffer.isBuffer( chunk ) ) {
                this.push( chunk );

                callback();
            }
            else {
                callback( "Invalid chunk type" );
            }
        }
    }

    _read ( size ) {
        if ( this.#stream ) {
            this.#read();
        }
        else {
            super._read( size );
        }
    }

    _destroy ( e, callback ) {
        this.#destroy();

        callback( e );
    }

    // private
    #read () {
        if ( this.#stream.readableLength ) {
            this.push( this.#stream.read() );
        }
        else {
            this.#stream.once( "readable", this.#readableListener );
        }
    }

    #onReadable () {
        const chunk = this.#stream.read();

        if ( chunk != null ) {
            this.push( chunk );
        }
    }

    #onError ( e ) {}

    #onClose () {
        const error = this.#stream.readableAborted
            ? this.#stream.errored || "Unexpected end of stream"
            : null;

        this.#setStream();

        const callback = this.#callback;
        this.#callback = null;

        callback( error );
    }

    #setStream ( stream ) {
        if ( this.#stream ) {
            this.#stream.off( "readable", this.#readableListener );
            this.#stream.off( "error", this.#errorListener );
            this.#stream.off( "close", this.#closeListener );

            this.#stream.setMaxListeners( this.#stream.getMaxListeners() - 1 );

            this.#stream = null;
        }

        if ( stream ) {
            stream.setMaxListeners( stream.getMaxListeners() + 1 );

            stream.once( "error", this.#errorListener );
            stream.once( "close", this.#closeListener );

            this.#stream = stream;
        }
    }

    #destroy () {

        // destroy buffered streams
        const streams = this.#streams;
        this.#streams = null;

        for ( const stream of streams ) {
            stream.destroy();
        }

        // destroy current stream
        if ( this.#stream ) {
            const stream = this.#stream;

            this.#setStream();

            stream.destroy();
        }

        this.#callback = null;
    }
}
