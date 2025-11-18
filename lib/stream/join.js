import stream from "#lib/stream";

export default class StreamJoin extends stream.Readable {
    #streams = [];
    #currentStream;
    #errorCallback = this.destroy.bind( this );

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
        while ( true ) {
            if ( !this.#currentStream ) {

                // EOF
                if ( !this.#streams.length ) {
                    return this.push( null );
                }

                let data = this.#streams.shift();

                try {
                    if ( typeof data === "function" ) {
                        data = data( !this.#streams.length );
                    }

                    // skip stream
                    if ( data === undefined ) {
                        continue;
                    }

                    // EOF
                    else if ( data === null ) {
                        return this.push( null );
                    }
                    else if ( !( data instanceof stream.Readable ) ) {
                        data = stream.Readable.from( data, {
                            "objectMode": false,
                        } );
                    }
                }
                catch ( e ) {
                    if ( data instanceof stream.Stream ) data.destroy();

                    return this.destroy( e );
                }

                this.#setCurrentStream( data );
            }

            const chunk = this.#currentStream.read( size );

            // EOF
            if ( chunk == null ) {
                this.#setCurrentStream();
            }
            else {
                return this.push( chunk );
            }
        }
    }

    _destroy ( e, callback ) {
        const streams = this.#streams;
        this.#streams = [];

        // destroy pending streams
        for ( const item of streams ) {
            if ( item instanceof stream.Stream ) item.destroy();
        }

        // destroy current stream
        if ( this.#currentStream ) {
            this.#currentStream.destroy();

            this.#setCurrentStream();
        }

        callback( e );
    }

    // private
    #setCurrentStream ( currentStream ) {
        if ( this.#currentStream ) {
            this.#currentStream.off( "error", this.#errorCallback );

            this.#currentStream.setMaxListeners( this.#currentStream.getMaxListeners() - 1 );

            this.#currentStream = null;
        }

        if ( currentStream ) {
            currentStream.setMaxListeners( currentStream.getMaxListeners() + 1 );

            currentStream.once( "error", this.#errorCallback );

            this.#currentStream = currentStream;
        }
    }
}
