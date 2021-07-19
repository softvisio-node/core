import _stream from "stream";

export default class StreamCombined extends _stream.Readable {
    #streams = [];
    #currentStream;

    // public
    append ( stream ) {
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

                if ( typeof this.#currentStream === "function" ) {
                    this.#currentStream = this.#currentStream( !this.#streams.length );
                }

                if ( typeof this.#currentStream === "string" || Buffer.isBuffer( this.#currentStream ) ) {
                    this.#currentStream = _stream.Readable.from( this.#currentStream );
                }

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
