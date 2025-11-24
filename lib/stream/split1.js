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
    #pendingRead = false;
    #readCallback = this.#read.bind( this );
    #errorListener = this.#onError.bind( this );
    #closeListener = this.#onClose.bind( this );

    constructor ( { eol } = {} ) {
        super( {
            "readableObjectMode": true,
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
        callback();
    }

    _destroy ( error, callback ) {
        this.#destroy( error );

        callback( error );
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

    // XXX
    #processChunks () {

        // need more data
        if ( !this.#chunks.length ) {
            this.#callTransformCallback();
        }
        else {

            // create new stream
            if ( !this.#stream ) {
                this.#createStream();
            }

            if ( this.#pendingRead ) this.#read();
        }
    }

    #callTransformCallback ( error ) {
        const callback = this.#transformCallback;
        this.#transformCallback = null;

        callback?.( error );
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

        // has buffered data
        if ( this.#chunks.length ) {
            this.#pendingRead = false;

            const chunk = this.#chunks.shift();

            this.#stream.push( chunk );
        }

        // need more data
        else {
            this.#pendingRead = true;

            this.#callTransformCallback();
        }
    }

    #onError ( e ) {}

    // XXX
    #onClose () {
        if ( this.#stream.readableAborted ) {
            this.destroy( this.#stream.errored || "Unexpected end of stream" );
        }
        else {
            this.#destroyStream();

            this.#processChunks();
        }
    }

    #destroyStream ( error ) {
        if ( !this.#stream ) return;

        const stream = this.#stream;
        this.#stream = null;

        this.#pendingRead = false;

        // remove listeners
        stream.off( "error", this.#errorListener );
        stream.off( "close", this.#closeListener );

        stream.destroy( error );
    }
}
