import stream from "#lib/stream";
import StreamSearch from "#lib/stream/search";

const DEFAULT_EOL = Buffer.from( "\n" );

export default class StreamSplit extends stream.Transform {
    #eol;
    #streamSearch;
    #stream;
    #transformCallback;
    #chunks = []; // XXX use doubly-linked list

    constructor ( { eol } = {} ) {
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

        this.#transformCallback = callback;

        this.#streamSearch.push( chunk );

        this.#processChunks();
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
    }

    #processChunks () {
        if ( !this.#chunks.length ) {
            this.#callTransformCallback();
        }
        else if ( !this.#stream ) {
            this.#stream = new stream.Readable( {
                "read": this.#onRead.bind( this ),
            } )
                .once( "error", e => {
                    this.#callTransformCallback( e );
                } )
                .once( "close", () => {
                    this.#stream = null;

                    this.#processChunks();

                    // this.#callTransformCallback();
                } );

            this.push( this.#stream );
        }
    }

    #callTransformCallback ( e ) {
        const callback = this.#transformCallback;

        this.#transformCallback = null;

        callback?.( e );
    }

    #onRead ( size ) {
        if ( this.#chunks.length ) {
            this.#stream.push( this.#chunks.shift() );
        }
        else {
            this.#callTransformCallback();
        }
    }
}
