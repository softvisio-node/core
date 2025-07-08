import stream from "#lib/stream";

export default class StreamCombined extends stream.PassThrough {
    #streams = [];
    #currentStream;

    // public
    append ( stream ) {
        this.#streams.push( stream );

        this.#pipe();

        return this;
    }

    // private
    async #pipe () {
        if ( this.#currentStream ) return;

        // eof
        if ( !this.#streams.length ) {
            this.push( null );

            return;
        }

        this.#currentStream = this.#streams.shift();

        if ( typeof this.#currentStream === "function" ) {
            this.#currentStream = this.#currentStream( !this.#streams.length );
        }

        if ( typeof this.#currentStream === "string" || Buffer.isBuffer( this.#currentStream ) ) {
            this.#currentStream = stream.Readable.from( this.#currentStream, { "objectMode": false } );
        }

        try {
            await stream.promises.pipeline( this.#currentStream, this, {
                "end": false,
            } );
        }
        catch ( e ) {
            const streams = this.#streams;
            this.#streams = [];

            for ( const part of streams ) {
                if ( part instanceof stream.Readable ) part.destroy( e );
            }
        }

        this.#currentStream = null;

        this.#pipe();
    }
}
