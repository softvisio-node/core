import stream from "#lib/stream";

export default class StreamJoin extends stream.Readable {
    #streams = [];
    #stream;
    #readableCallback = this.#onReadable.bind( this );
    #errorCallback = this.destroy.bind( this );
    #closeCallback = this.#onClose.bind( this );

    // public
    append ( data, encoding ) {
        if ( typeof data === "string" ) {
            data = Buffer.from( data, encoding );
        }

        this.#streams.push( data );

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
            this.#stream.once( "readable", this.#readableCallback );
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

    #onClose () {
        if ( !this.#stream.readableEnded ) {
            this.destroy( "Unexpected end of stream" );
        }
    }

    #setStream ( currentStream ) {
        if ( this.#stream ) {
            this.#stream.off( "readable", this.#readableCallback );
            this.#stream.off( "error", this.#errorCallback );
            this.#stream.off( "close", this.#closeCallback );

            this.#stream.setMaxListeners( this.#stream.getMaxListeners() - 1 );

            this.#stream = null;
        }

        if ( currentStream ) {
            currentStream.setMaxListeners( currentStream.getMaxListeners() + 1 );

            currentStream.once( "error", this.#errorCallback );
            currentStream.once( "close", this.#closeCallback );

            this.#stream = currentStream;
        }
    }

    #nextStream () {
        if ( this.#stream ) return;

        // no streams
        if ( !this.#streams.length ) return;

        let data = this.#streams.shift();

        try {
            if ( typeof data === "function" ) {
                data = data( !this.#streams.length );
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
                    data = stream.Readable.from( data, {
                        "objectMode": false,
                    } );
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
        const streams = this.#streams;
        this.#streams = [];

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
