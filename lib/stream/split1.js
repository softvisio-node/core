import stream from "#lib/stream";
import StreamSearch from "#lib/stream/search";

const DEFAULT_EOL = Buffer.from( "\n" );

export default class StreamSplit extends stream.Transform {
    #eol;
    #streamSearch;
    #currentStream;
    #transformCallback;
    #chunks = [];

    constructor ( eol ) {
        super( {
            "objectMode": true,
        } );

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
    _transform ( chunk, encoding, callback ) {
        if ( !Buffer.isBuffer( chunk ) ) {
            chunk = Buffer.from( chunk, encoding );
        }

        this.#streamSearch.push( chunk );

        this.#transformCallback = callback;
    }

    // XXX rest
    _flush ( callback ) {
        callback();
    }

    // private
    #onInfo ( isMatched, data, start, end ) {

        // push data
        if ( data ) {
            this.#chunks.push( data.subarray( start, end ) );
        }

        // match
        if ( isMatched ) {
            this.#chunks.push( null );
        }

        this.#processChunks();
    }

    #processChunks () {
        if ( !this.#chunks.length ) {
            this.#callTransformCallback();
        }
        else if ( !this.#currentStream ) {
            this.#currentStream = new stream.Readable( {
                "read": this.#onRead.bind( this ),
            } )
                .once( "error", e => {
                    this.#callTransformCallback( e );
                } )
                .once( "close", () => {
                    this.#currentStream = null;

                    this.#processChunks();

                    // this.#callTransformCallback();
                } );

            this.push( this.#currentStream );
        }
    }

    #callTransformCallback ( e ) {
        const callback = this.#transformCallback;

        this.#transformCallback = null;

        callback?.( e );
    }

    #onRead ( size ) {
        if ( this.#chunks.length ) {
            this.#currentStream.push( this.#chunks.shift() );
        }
        else {
            this.#callTransformCallback();
        }
    }
}
