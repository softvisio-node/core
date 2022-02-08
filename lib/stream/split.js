import stream from "#lib/stream";
import StreamSearch from "#lib/stream/search";

const DEFAULT_EOL = Buffer.from( "\n" );

export default class StreamJson extends stream.Transform {
    #eol;
    #streamSearch;
    #currentStream;
    #activeStreams = new Set();

    constructor ( eol ) {
        super( { "objectMode": true } );

        this.#eol = eol ? ( Buffer.isBuffer( eol ) ? eol : Buffer.from( eol ) ) : DEFAULT_EOL;

        this.#streamSearch = new StreamSearch( this.#eol );
        this.#streamSearch.on( "info", this.#onInfo.bind( this ) );

        this.on( "error", e => this.#destroyActiveStreams( e ) );
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        if ( Buffer.isBuffer( chunk ) ) chunk = chunk.toString();

        this.#streamSearch.push( chunk );

        callback( null );
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
        const currentStream = new stream.Readable( { read () {} } ) //
            .on( "error", e => {
                this.destroy( e );
            } )
            .on( "close", () => {
                this.#activeStreams.delete( currentStream );

                if ( !this.#activeStreams.size && this.destroyed ) this.emit( "complete" );
            } );

        this.#activeStreams.add( currentStream );

        this.#currentStream = currentStream;

        this.push( currentStream );
    }

    #closeCurrentStream () {

        // send eof
        this.#currentStream.push( null );

        this.#currentStream = null;
    }

    #destroyActiveStreams ( e ) {
        this.#activeStreams.forEach( stream => stream.destroy( e ) );

        this.#activeStreams.clear();
    }
}
