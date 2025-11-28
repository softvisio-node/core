import StreamSearch from "#lib/stream/search";
import StreamSubstreams from "#lib/stream/substreams";

const DEFAULT_EOL = Buffer.from( "\n" );

export default class StreamSplitter extends StreamSubstreams {
    #eol;
    #streamsearch;

    constructor ( { eol } = {} ) {
        super();

        this.#eol = eol
            ? ( Buffer.isBuffer( eol )
                ? eol
                : Buffer.from( eol ) )
            : DEFAULT_EOL;

        this.#streamsearch = new StreamSearch( this.#eol );
        this.#streamsearch.on( "info", this.#onInfo.bind( this ) );
    }

    // properties
    get eol () {
        return this.#eol;
    }

    // protected
    _transformData ( data, callback ) {
        this.#streamsearch.push( data );

        callback();
    }

    // XXX
    _flushData ( callback ) {

        // XXX
        // this._pushData( null );

        callback();
    }

    // XXX
    _destroy ( error, callback ) {
        this.#streamsearch.reset();
        this.#streamsearch = null;

        super._destroy( error, callback );
    }

    // private
    #onInfo ( isMatched, data, start, end ) {

        // push data
        if ( data ) {
            this._pushData( data.subarray( start, end ) );
        }

        // match
        if ( isMatched ) {
            this._pushData( null );
        }
    }
}
