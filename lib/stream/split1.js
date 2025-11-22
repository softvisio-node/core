import Queue from "#lib/data-structures/queue";
import stream from "#lib/stream";
import StreamSearch from "#lib/stream/search";

const DEFAULT_EOL = Buffer.from( "\n" );

export default class StreamSplit extends stream.Transform {
    #eol;
    #streamsearch;
    #transformCallback;
    #chunks = new Queue();
    #stream;
    #readCallback = this.#read.bind( this );
    #errorListener = this.#onError.bind( this );
    #closeListener = this.#onClose.bind( this );

    constructor ( { eol } = {} ) {
        super( {
            "readObjectMode": true,
        } );

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
    _transform ( chunk, encoding, callback ) {
        if ( !Buffer.isBuffer( chunk ) ) {
            chunk = Buffer.from( chunk, encoding );
        }

        this.#transformCallback = callback;

        this.#streamsearch.push( chunk );

        this.#processChunks();
    }

    // XXX rest
    _flush ( callback ) {
        this.#destroy();

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
            this.#createStream();
        }
    }

    #callTransformCallback ( e ) {
        const callback = this.#transformCallback;

        this.#transformCallback = null;

        callback?.( e );
    }

    #destroy ( error ) {
        this.#transformCallback = null;
        this.#chunks.clear();
        this.#streamsearch.reset();
        this.#destroyStream( error );
    }

    #createStream () {
        this.#destroyStream();

        this.#stream = new stream.Readable( {
            "read": this.#readCallback,
        } )
            .once( "error", this.#errorListener )
            .once( "close", this.#closeListener );

        this.push( this.#stream );
    }

    #read ( size ) {
        if ( this.#chunks.length ) {
            this.#stream.push( this.#chunks.shift() );
        }
        else {
            this.#callTransformCallback();
        }
    }

    #onError ( e ) {
        this.#callTransformCallback( e );
    }

    #onClose () {
        this.#destroyStream();

        this.#processChunks();

        // this.#callTransformCallback();
    }

    #destroyStream ( error ) {
        if ( !this.#stream ) return;

        const stream = this.#stream;
        this.#stream = null;

        // remove listeners
        stream.off( "error", this.#errorListener );
        stream.off( "close", this.#closeListener );

        stream.destroy( error );
    }
}
