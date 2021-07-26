import stream from "stream";
import _StreamSearch from "#lib/stream/search";

const DEFAULT_EOL = Buffer.from( "\n" );

class StreamSplitReadable extends stream.Readable {
    #finished;

    // properties
    get isFinished () {
        return !!this.#finished;
    }

    // public
    skip () {
        if ( this.#finished ) return;

        this.#finished = true;

        this.emit( "skip" );
    }

    cancel ( error ) {
        if ( this.#finished ) return;

        this.#finished = true;

        this.emit( "cancel", error || "Cancelled" );
    }

    finish () {
        if ( this.#finished ) return;

        this.#finished = true;

        this.emit( "finish" );
    }

    // private
    _read () {}

    _destroy ( error, callback ) {
        if ( error ) this.#finished = true;

        callback( error );
    }
}

export default class StreamSplit extends stream.Writable {
    #eol;

    #streamSearch;
    #sourceStreamErrorListener;
    #currentStream;

    // complete
    #isCompleted;
    #pendingStreams = 0;
    #error;

    constructor ( options = {} ) {
        super( options );

        this.#eol = options.eol ? ( Buffer.isBuffer( options.eol ) ? options.eol : Buffer.from( options.eol ) ) : DEFAULT_EOL;

        this.#streamSearch = new _StreamSearch( this.#eol );
        this.#streamSearch.on( "info", this.#onInfo.bind( this ) );

        this.on( "pipe", stream => {
            this.#sourceStreamErrorListener = e => this.destroy( e );

            stream.once( "error", this.#sourceStreamErrorListener );
        } );

        this.on( "unpipe", stream => {
            stream.off( "error", this.#sourceStreamErrorListener );

            this.#sourceStreamErrorListener = null;
        } );
    }

    // properties
    get isCompleted () {
        return !!this.#completed;
    }

    // protected
    _write ( data, encoding, callback ) {
        this.#streamSearch.push( data );

        callback( null );
    }

    _destroy ( error, callback ) {
        this.#streamSearch = null;

        if ( this.#currentStream ) {
            if ( error ) this.#currentStream.destroy( error );
            else this.#currentStream.push( null );

            this.#currentStream = null;
        }

        this.#completed( error );

        callback( error );
    }

    // private
    #onInfo ( isMatched, data, start, end ) {
        if ( !this.#currentStream ) this.#openCurrentStream();

        // match
        if ( isMatched ) {

            // push data
            if ( data ) {
                this.#currentStream.push( data.slice( start, end ) );
            }

            this.#closeCurrentStream();
        }

        // not match
        else {
            this.#currentStream.push( data.slice( start, end ) );
        }
    }

    #openCurrentStream () {
        const stream = new StreamSplitReadable();

        this.#pendingStreams++;

        stream.once( "error", error => {
            this.#onStreamFinish( stream, error );
        } );

        stream.once( "skip", () => {
            this.#onStreamFinish( stream );
        } );

        stream.once( "cancel", error => {
            this.#onStreamFinish( stream, error );
        } );

        stream.once( "finish", () => {
            this.#onStreamFinish( stream );
        } );

        this.#currentStream = stream;

        this.emit( "chunk", this.#currentStream );
    }

    #closeCurrentStream () {

        // send eof
        this.#currentStream.push( null );

        this.#currentStream = null;
    }

    #onStreamFinish ( stream, error ) {
        stream.destroy();

        this.#pendingStreams--;

        this.#completed( error );
    }

    #completed ( error ) {
        if ( this.#isCompleted ) return;

        this.#error ??= error;

        if ( this.#pendingStreams || !this.destroyed ) return;

        this.#isCompleted = true;

        this.emit( "completed", this.#error );
    }
}
