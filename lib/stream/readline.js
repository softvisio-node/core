import Stream from "stream";
import StreamSearch from "./search.js";

const DEFAULT_ENCODING = "binary";
const DEFAULT_EOL = Buffer.from( "\n" );

export default class ReadLine extends Stream.Transform {
    #eol;
    #encoding;
    #maxLength;
    #maxLines;
    #streamSearch;
    #buffers = [];
    #buffersLength = 0;
    #matches = [];
    #lines = 0;

    constructor ( options = {} ) {
        super();

        this.#encoding = options.encoding ?? DEFAULT_ENCODING;

        this.#eol = options.eol ?? DEFAULT_EOL;

        if ( typeof this.#eol === "string" ) this.#eol = Buffer.from( this.#eol, this.#encoding );

        this.#maxLength = options.maxLength ?? Infinity;
        this.#maxLines = options.maxLines ?? Infinity;

        this.#streamSearch = new StreamSearch( this.#eol, { "maxMatches": this.#maxLines } );

        this.on( "pipe", this.#onPipe.bind( this ) );
        this.on( "unpipe", this.#onUnpipe.bind( this ) );
    }

    // protected
    _transform ( data, encoding, callback ) {
        const pos = this.#streamSearch.push( data );

        console.log( "--- PUSH:", data + "", data.length, pos );

        if ( this.#matches.length ) {
            const matches = this.#matches;
            this.#matches = [];

            for ( const match of matches ) {
                this.#lines++;

                let buf;

                if ( match.length === 0 ) buf = Buffer.alloc( 0 );
                else if ( match.length === 1 ) buf = match[0];
                else buf = Buffer.concat( match );

                this.push( buf );

                if ( this.#lines >= this.#maxLines ) break;
            }
        }

        callback( null, null );
    }

    // private
    #onPipe ( src ) {
        this.#streamSearch.on( "info", this.#onInfo.bind( this ) );
    }

    // XXX cleanup
    // XXX check, that listeners removed
    #onUnpipe ( src ) {
        this.#streamSearch.off( "info", this.#onInfo.bind( this ) );

        this.#streamSearch.reset();
    }

    #onInfo ( isMatched, data, start, end ) {
        if ( isMatched ) {
            if ( data ) this.#addBuffer( data.slice( start, end ) );

            this.#matches.push( this.#buffers );

            this.#buffers = [];
            this.#buffersLength = 0;
        }
        else {
            this.#addBuffer( data.slice( start, end ) );
        }
    }

    #addBuffer ( buf ) {
        this.#buffersLength += buf.length;

        this.#buffers.push( buf );
    }
}
