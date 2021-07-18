import stream from "stream";
import _StreamSearch from "#lib/stream/search";

const DEFAULT_EOL = Buffer.from( "\n" );

class SplitReadable extends stream.Readable {
    _read () {}
}

export default class StreamSearch extends stream.Writable {
    #eol;
    #streamSearch;
    #onInfoHandler;
    #onErrorHandler;
    #currentStream;

    constructor ( eol ) {
        super();

        this.#eol = eol ? ( Buffer.isBuffer( eol ) ? eol : Buffer.from( eol ) ) : DEFAULT_EOL;

        this.#streamSearch = new _StreamSearch( this.#eol );

        this.on( "pipe", this.#onPipe.bind( this ) );
        this.on( "unpipe", this.#onUnpipe.bind( this ) );
    }

    // protected
    _write ( data, encoding, callback ) {
        this.#streamSearch.push( data );

        callback( null, null );
    }

    // private
    #onPipe ( stream ) {
        this.#onErrorHandler = this.#onError.bind( this );
        stream.once( "error", this.#onErrorHandler );

        this.#onInfoHandler = this.#onInfo.bind( this );
        this.#streamSearch.on( "info", this.#onInfoHandler );
    }

    #onUnpipe ( stream ) {
        stream.off( "error", this.#onErrorHandler );

        this.#streamSearch.off( "info", this.#onInfoHandler );
        this.#streamSearch.reset();
    }

    #onError ( e ) {
        if ( this.#currentStream ) this.#currentStream.destroy( e );
    }

    #onInfo ( isMatched, data, start, end ) {
        if ( !this.#currentStream ) this.#openStream();

        // match
        if ( isMatched ) {

            // push data
            if ( data ) {
                this.#currentStream.push( data.slice( start, end ) );
            }

            this.#closeStream();
        }

        // not match
        else {
            this.#currentStream.push( data.slice( start, end ) );
        }
    }

    #openStream () {
        if ( this.#currentStream ) this.#closeStream();

        this.#currentStream = new SplitReadable();

        this.emit( "chunk", this.#currentStream );
    }

    #closeStream () {
        if ( !this.#currentStream ) return;

        // send eof
        this.#currentStream.push( null );

        this.#currentStream = null;
    }
}
