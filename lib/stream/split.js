import stream from "#lib/stream";
import StreamSearch from "#lib/stream/search";

const DEFAULT_EOL = Buffer.from( "\n" );

export default class StreamJson extends stream.Duplex {
    #eol;
    #streamSearch;
    #streams = new Set();
    #currentStream;

    constructor ( eol ) {
        super( { "readableObjectMode": true, "allowHalfOpen": true } );

        this.#eol = eol
            ? ( Buffer.isBuffer( eol )
                ? eol
                : Buffer.from( eol ) )
            : DEFAULT_EOL;

        this.#streamSearch = new StreamSearch( this.#eol );
        this.#streamSearch.on( "info", this.#onInfo.bind( this ) );
    }

    // properties
    get eol () {
        return this.#eol;
    }

    // protected
    // init stream, error can be returned
    _construct ( callback ) {
        callback();
    }

    _write ( chunk, encoding, callback ) {
        this.#streamSearch.push( chunk );

        callback();
    }

    _read ( size ) {}

    async _processStream ( stream ) {
        return stream;
    }

    // called on writable end, delays "final" event
    _final ( callback ) {
        this.#endCurrentStream();

        callback();
    }

    // called on destroy, delays "close" event
    _destroy ( error, callback ) {
        if ( error ) {
            this.#streams.forEach( stream => stream.destroy( error ) );
        }

        callback( error );
    }

    // private
    #onInfo ( isMatched, data, start, end ) {
        if ( !this.#currentStream ) this.#createStream();

        // match
        if ( isMatched ) {

            // push data
            if ( data ) {
                this.#currentStream.push( data.subarray( start, end ) );
            }

            this.#endCurrentStream();
        }

        // not match
        else {
            this.#currentStream.push( data.subarray( start, end ) );
        }
    }

    async #createStream () {
        const _stream = new stream.Readable( { read () {} } );

        _stream.once( "error", this.#onChildStreamError.bind( this, _stream ) );
        _stream.once( "close", this.#onChildStreamClose.bind( this, _stream ) );

        this.#streams.add( _stream );

        this.#currentStream = _stream;

        // process stream
        const data = await this._processStream( _stream );

        if ( data ) this.push( data );
    }

    #endCurrentStream () {
        if ( !this.#currentStream ) return;

        // send eof
        this.#currentStream.push( null );

        this.#currentStream = null;
    }

    #onChildStreamError ( stream, e ) {
        this.destroy( e );
    }

    #onChildStreamClose ( stream ) {
        this.#streams.delete( stream );

        // end readable if writable stream ended and no processing streams
        if ( !this.#streams.size && this.writableEnded ) this.push( null );
    }
}
