import stream from "#lib/stream";
import StreamSearch from "#lib/stream/search";

const DEFAULT_EOL = Buffer.from( "\n" );

export default class StreamJson extends stream.Transform {
    #eol;
    #streamSearch;
    #currentStream;
    #activeStreams = new Set();
    #errorListener;

    constructor ( eol ) {
        super( { "objectMode": true } );

        this.#eol = eol ? ( Buffer.isBuffer( eol ) ? eol : Buffer.from( eol ) ) : DEFAULT_EOL;

        this.#streamSearch = new StreamSearch( this.#eol );
        this.#streamSearch.on( "info", this.#onInfo.bind( this ) );

        this.once( "error", e => this.#destroyActiveStreams( e ) );

        this.once( "end", () => this.#endCurrentStream() );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( Buffer.isBuffer( chunk ) ) chunk = chunk.toString();

        this.#streamSearch.push( chunk );

        callback( null );
    }

    // protected
    _onNewStream ( stream ) {
        this.push( stream );
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

            this.#endCurrentStream();
        }

        // not match
        else {
            this.#currentStream.push( data.slice( start, end ) );
        }
    }

    #openCurrentStream () {
        const newStream = new stream.Readable( { read () {} } );

        this.#errorListener ??= e => this.destroy( e );

        newStream.once( "error", this.#errorListener );

        newStream.once( "close", () => {
            this.#activeStreams.delete( newStream );

            if ( !this.#activeStreams.size && this.destroyed ) this.emit( "complete" );
        } );

        this.#activeStreams.add( newStream );

        this.#currentStream = newStream;

        this._onNewStream( newStream );
    }

    #endCurrentStream () {
        if ( !this.#currentStream ) return;

        // send eof
        this.#currentStream.push( null );

        this.#currentStream = null;
    }

    #destroyActiveStreams ( e ) {
        this.#activeStreams.forEach( stream => {
            stream.off( "error", this.#errorListener );

            stream.destroy( e );
        } );
    }
}
