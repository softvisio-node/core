import stream from "stream";
import _StreamSearch from "#lib/stream/search";

const DEFAULT_EOL = Buffer.from( "\n" );

class StreamSplitReadable extends stream.Readable {
    #cancelled;

    // public
    cancel ( error ) {
        if ( this.#cancelled ) return;

        this.#cancelled = true;

        this.emit( "cancel", error );
    }

    // private
    _read () {}
}

export default class StreamSplit extends stream.Writable {
    #eol;

    #streamSearch;
    #sourceStreamErrorListener;
    #currentStream;

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

    // protected
    _write ( data, encoding, callback ) {
        this.#streamSearch.push( data );

        callback( null );
    }

    _destroy ( e, callback ) {
        this.#streamSearch = null;

        if ( this.#currentStream ) {
            if ( e ) this.#currentStream.destroy( e );
            else this.#currentStream.push( null );

            this.#currentStream = null;
        }

        callback( e );
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
        this.#currentStream = new StreamSplitReadable();

        this.emit( "chunk", this.#currentStream );
    }

    #closeCurrentStream () {

        // send eof
        this.#currentStream.push( null );

        this.#currentStream = null;
    }
}
