import Queue from "#lib/data-structures/queue";
import stream from "#lib/stream";

export default class StreamJoin extends stream.Readable {
    #queue = new Queue();
    #stream;
    #readableListener = this.#onReadable.bind( this );
    #errorListener = this.#onError.bind( this );
    #closeListener = this.#onClose.bind( this );

    // public
    append ( data, encoding ) {
        if ( typeof data === "string" ) {
            data = Buffer.from( data, encoding );
        }

        this.#queue.push( data );

        return this;
    }

    // protected
    _read ( size ) {
        this.#read();
    }

    _destroy ( e, callback ) {
        this.#destroy();

        callback( e );
    }

    // private
    #read () {
        this.#nextStream();

        // EOF
        if ( !this.#stream ) {
            this.push( null );
        }
        else if ( this.#stream.readableLength ) {
            this.push( this.#stream.read() );
        }
        else {
            this.#stream.once( "readable", this.#readableListener );
        }
    }

    #onReadable () {
        const chunk = this.#stream.read();

        // EOF
        if ( chunk == null ) {
            this.#setStream();

            this.#read();
        }
        else {
            this.push( chunk );
        }
    }

    #onError ( e ) {}

    #onClose () {
        if ( this.#stream.readableAborted ) {
            this.destroy( this.#stream.errored || "Unexpected end of stream" );
        }
    }

    #setStream ( currentStream ) {
        if ( this.#stream ) {
            this.#stream.off( "readable", this.#readableListener );
            this.#stream.off( "error", this.#errorListener );
            this.#stream.off( "close", this.#closeListener );

            this.#stream.setMaxListeners( this.#stream.getMaxListeners() - 1 );

            this.#stream = null;
        }

        if ( currentStream ) {
            currentStream.setMaxListeners( currentStream.getMaxListeners() + 1 );

            currentStream.once( "error", this.#errorListener );
            currentStream.once( "close", this.#closeListener );

            this.#stream = currentStream;
        }
    }

    #nextStream () {
        if ( this.#stream ) return;

        // no streams
        if ( !this.#queue.length ) return;

        let data = this.#queue.shift();

        try {
            if ( typeof data === "function" ) {
                data = data( !this.#queue.length );
            }

            // skip stream
            if ( data === undefined ) {
                this.#nextStream();
            }

            // EOF
            else if ( data === null ) {
                return;
            }
            else {
                if ( !( data instanceof stream.Readable ) ) {
                    data = stream.Readable.from( data );
                }

                this.#setStream( data );
            }
        }
        catch ( e ) {
            if ( data instanceof stream.Stream ) data.destroy();

            this.destroy( e );
        }
    }

    #destroy () {
        const streams = this.#queue;
        this.#queue = [];

        // destroy pending streams
        for ( const item of streams ) {
            if ( item instanceof stream.Stream ) item.destroy();
        }

        // destroy current stream
        if ( this.#stream ) {
            this.#stream.destroy();

            this.#setStream();
        }
    }
}

export class StreamJoin1 extends stream.Duplex {
    #queue = new Queue();
    #stream;
    #writeCallback;
    #readableListener = this.#onReadable.bind( this );
    #errorListener = this.#onError.bind( this );
    #closeListener = this.#onClose.bind( this );

    constructor () {
        super( {
            "writableObjectMode": true,
            "writableHighWaterMark": 1,
        } );
    }

    // protected
    // XXX
    _write ( chunk, encoding, callback ) {
        this.#writeCallback = callback;

        this.#queue.push( chunk );

        this.#read();
    }

    _read ( size ) {
        this.#read();
    }

    _destroy ( e, callback ) {
        this.#destroy();

        callback( e );
    }

    // private
    #read () {
        this.#nextStream();

        // EOF
        if ( !this.#stream ) {
            this.push( null );
        }
        else if ( this.#stream.readableLength ) {
            this.push( this.#stream.read() );
        }
        else {
            this.#stream.once( "readable", this.#readableListener );
        }
    }

    #onReadable () {
        const chunk = this.#stream.read();

        // EOF
        if ( chunk == null ) {
            this.#setStream();

            this.#read();
        }
        else {
            this.push( chunk );
        }
    }

    #onError ( e ) {}

    #onClose () {
        if ( this.#stream.readableAborted ) {
            this.destroy( this.#stream.errored || "Unexpected end of stream" );
        }
    }

    #setStream ( currentStream ) {
        if ( this.#stream ) {
            this.#stream.off( "readable", this.#readableListener );
            this.#stream.off( "error", this.#errorListener );
            this.#stream.off( "close", this.#closeListener );

            this.#stream.setMaxListeners( this.#stream.getMaxListeners() - 1 );

            this.#stream = null;
        }

        if ( currentStream ) {
            currentStream.setMaxListeners( currentStream.getMaxListeners() + 1 );

            currentStream.once( "error", this.#errorListener );
            currentStream.once( "close", this.#closeListener );

            this.#stream = currentStream;
        }
    }

    #nextStream () {
        if ( this.#stream ) return;

        // no streams
        if ( !this.#queue.length ) {
            this.#callWriteCallback();

            return;
        }

        let data = this.#queue.shift();

        try {
            if ( typeof data === "function" ) {
                data = data( !this.#queue.length );
            }

            // skip stream
            if ( data === undefined ) {
                this.#nextStream();
            }

            // EOF
            else if ( data === null ) {
                return;
            }
            else {
                if ( !( data instanceof stream.Readable ) ) {
                    data = stream.Readable.from( data );
                }

                this.#setStream( data );
            }
        }
        catch ( e ) {
            if ( data instanceof stream.Stream ) data.destroy();

            this.destroy( e );
        }
    }

    #callWriteCallback () {
        const callback = this.#writeCallback;
        this.#writeCallback = null;

        callback?.();
    }

    #destroy () {
        this.#writeCallback = null;

        const streams = this.#queue;
        this.#queue = null;

        // destroy pending streams
        for ( const item of streams ) {
            if ( item instanceof stream.Stream ) item.destroy();
        }

        // destroy current stream
        if ( this.#stream ) {
            this.#stream.destroy();

            this.#setStream();
        }
    }
}
