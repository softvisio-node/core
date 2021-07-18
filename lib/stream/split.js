import stream from "stream";
import _StreamSearch from "#lib/stream/search";

const DEFAULT_EOL = Buffer.from( "\n" );

class StreamSplitReadable extends stream.Readable {
    _read () {}
}

export default class StreamSplit extends stream.Writable {
    #eol;
    #lastEOLRequired;

    #streamSearch;
    #onInfoListener;
    #sourceStreamErrorListener;
    #currentStream;

    constructor ( options = {} ) {
        super();

        this.#eol = options.eol ? ( Buffer.isBuffer( options.eol ) ? options.eol : Buffer.from( options.eol ) ) : DEFAULT_EOL;

        this.#lastEOLRequired = options.lastEOLRequired ?? true;

        this.#streamSearch = new _StreamSearch( this.#eol );

        this.on( "pipe", stream => {
            this.#sourceStreamErrorListener = this.#onSourceStreamError.bind( this );
            stream.once( "error", this.#sourceStreamErrorListener );

            this.#onInfoListener = this.#onInfo.bind( this );
            this.#streamSearch.on( "info", this.#onInfoListener );
        } );

        this.on( "unpipe", stream => {

            // remove error listener fromthe source stream
            if ( this.#sourceStreamErrorListener ) {
                stream.off( "error", this.#sourceStreamErrorListener );

                this.#sourceStreamErrorListener = null;
            }

            // reset search
            this.#resetSearch();

            // destroy current stream
            this.#destroyCurrentStream();
        } );

        this.once( "error", e => {

            // destroy current stream
            this.#destroyCurrentStream( e );
        } );

        this.once( "close", () => {

            // reset search
            this.#resetSearch();

            // destroy current stream
            this.#destroyCurrentStream();
        } );
    }

    // protected
    _write ( data, encoding, callback ) {
        this.#streamSearch.push( data );

        callback( null );
    }

    // private
    #onSourceStreamError ( e ) {

        // forward error to the current stream
        this.#destroyCurrentStream( e );

        // self destroy with error
        this.destroy( e );
    }

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
        if ( this.#currentStream ) this.#closeCurrentStream();

        this.#currentStream = new StreamSplitReadable();

        this.emit( "chunk", this.#currentStream );
    }

    #closeCurrentStream () {
        if ( !this.#currentStream ) return;

        // send eof
        this.#currentStream.push( null );

        this.#currentStream = null;
    }

    #destroyCurrentStream ( error ) {
        if ( this.#currentStream ) {
            if ( error ) this.#currentStream.destroy( error );
            else if ( this.#lastEOLRequired ) this.#currentStream.destroy( "Incomplete" );
            else this.#currentStream.push( null );

            this.#currentStream = null;
        }
    }

    #resetSearch () {
        if ( this.#onInfoListener ) this.#streamSearch.off( "info", this.#onInfoListener );

        this.#streamSearch.reset();
    }
}
