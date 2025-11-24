import StreamSearch from "#lib/stream/search";
import StreamSplit from "#lib/stream/split1";

const DEFAULT_EOL = Buffer.from( "\n" );

export default class StreamSplit2 extends StreamSplit {
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
    async _transformData ( data ) {
        this.#streamsearch.push( data );
    }

    _destroyData () {
        this.#streamsearch.reset();
        this.#streamsearch = null;
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
