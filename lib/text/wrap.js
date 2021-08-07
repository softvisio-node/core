const SEGMENTER = new Intl.Segmenter( "en", { "granularity": "grapheme" } );

class Wrap {
    #maxLength;
    #trim;
    #wordWrap;

    #output = "";
    #ansiCodeStarted;
    #word = [];
    #wordLength = 0;
    #line = [];
    #lineLength = 0;
    #ansiCode = [];
    #ansiStyles = "";

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
                this.#endLine( char );
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
    #startANSICode ( char ) {
        this.#ansiCode.push( char );

        this.#ansiCodeStarted = true;
    }

    // XXX process "\n" and " "
    #addANSICode ( char ) {
        this.#ansiCode.push( char );

        const codePoint = char.charCodeAt( 0 );

        if ( char === "[" && this.#ansiCode.length === 2 && this.#ansiCode[0] === "\x1b" ) {
            return;
        }

        // escape sequence parameter
        else if ( ( codePoint >= 0x30 && codePoint <= 0x3f ) || ( codePoint >= 0x20 && codePoint <= 0x2f ) ) {
            return;
        }

        // end of the escape sequence
        else if ( codePoint >= 0x40 && codePoint <= 0x7e ) {

            // style
            // XXX push to stack
            if ( char === "m" ) {
                this.#word.push( this.#ansiCode.join( "" ) );
            }

            this.#ansiCodeStarted = false;
            this.#ansiCode = [];
        }

        // invalid escape sequence
        else {

            // XXX
            this.#ansiCodeStarted = false;
            this.#ansiCode = [];
        }
    }

    // XXX split word
    #endLine ( char ) {
        this.#output += this.#line.join( "" );

        this.#line = [];
        this.#lineLength = 0;
    }

    // XXX
    #endWord ( char ) {
        this.#line.push( ...this.#word );

        this.#word = [];
        this.#wordLength = 0;
    }

    #addChar ( char ) {
        this.#word.push( char );
        this.#wordLength++;
    }
}

export default function wrap ( string, maxLength, options = {} ) {
    const wrap = new Wrap( maxLength, options );

    return wrap.wrap( string );
}
