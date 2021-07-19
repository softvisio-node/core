import _stream from "stream";

export default class StreamCombined extends _stream.Readable {
    #streams = [];
    #currentStream;

    // public
    append ( stream, options ) {
        if ( typeof stream === "string" || Buffer.isBuffer( stream ) ) stream = _stream.Readable.from( stream, options );

        this.#streams.push( stream );
    }

    // private
    _read () {
        if ( !this.#currentStream ) {
            if ( !this.#streams.length ) {

                // eof
                this.push( null );

                return;
            }
            else {
                this.#currentStream = this.#streams.shift();

                this.#currentStream.once( "end", () => {
                    this.#currentStream = null;
                } );

                this.#currentStream.once( "error", e => {
                    this.destroy( e );

                    this.#streams = [];
                    this.#currentStream = null;
                } );
            }
        }

        this.#currentStream.once( "readable", () => {
            const data = this.#currentStream.read();

            this.push( data ?? "" );
        } );
    }
}
