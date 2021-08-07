const SEGMENTER = new Intl.Segmenter( "en", { "granularity": "grapheme" } );

class Wrap {
    #maxLength;
    #trim;
    #wordWrap;

    #output = "";
    #ansiCodeStarted;
    #word = [];
    #line = [];
    #ansiCode = [];

    constructor ( maxLength, options ) {
        this.#maxLength = maxLength;
        this.#trim = options.trim;
        this.#wordWrap = options.wordWrap;
    }

    // public
    wrap ( string ) {
        const segments = SEGMENTER.segment( string );

        for ( const { "segment": char } of segments ) {
            if ( this.#ansiCodeStarted ) {
                this.#addANSICode( char );
            }
            else if ( char === "\x1b" || char === "\u009b" ) {
                this.#startANSICode( char );
            }
            else if ( char === "\n" ) {
                this.#endLine();
            }
            else if ( char === " " ) {
                this.#endWord( char );
            }
            else {
                const codePoint = char.charCodeAt( 0 );

                // control character, ignore
                if ( codePoint <= 0x1f || ( codePoint >= 0x7f && codePoint <= 0x9f ) ) continue;

                this.#addChar( char );
            }
        }

        this.#endWord();
        this.#endLine();

        return this.#output;
    }

    // private
    #startANSICode ( char ) {}

    #addANSICode ( char ) {}

    #endLine () {
        this.#output += this.#line.join( "" );

        this.#line = [];
    }

    #endWord ( char ) {
        this.#line.push( ...this.#word );

        this.#word = [];
    }

    #addChar ( char ) {
        this.#word.push( char );
    }
}

export default function wrap ( string, maxLength, options = {} ) {
    const wrap = new Wrap( maxLength, options );

    return wrap.wrap( string );
}
