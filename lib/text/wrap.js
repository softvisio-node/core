const SEGMENTER = new Intl.Segmenter( "en", { "granularity": "grapheme" } );

class Wrap {
    #maxLength;
    #trim;
    #wordWrap;

    #output = "";
    #ansiCodeStarted;
    #word = [];
    #wordVisibleLength = 0;
    #line = "";
    #lineVisibleLength = 0;
    #ansiCode = [];
    #ansiStyle = "";

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
            else {
                this.#addChar( char );
            }
        }

        this.#endANSICode();
        this.#endWord();

        return this.#output;
    }

    // private
    #startANSICode ( char ) {
        this.#ansiCode.push( char );

        this.#ansiCodeStarted = true;
    }

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
            this.#endANSICode( true );
        }

        // invalid escape sequence
        else {
            this.#endANSICode();
        }
    }

    #addChar ( char ) {

        // new word
        if ( char === " " || char === "\n" ) {
            this.#endWord( char );
        }
        else {
            const codePoint = char.charCodeAt( 0 );

            // control character, ignore
            if ( codePoint <= 0x1f || ( codePoint >= 0x7f && codePoint <= 0x9f ) ) return;

            this.#word.push( char );
            this.#wordVisibleLength++;
        }
    }

    #endANSICode ( valid ) {
        if ( valid ) {

            // style
            if ( this.#ansiCode.at( -1 ) === "m" ) {
                const style = this.#ansiCode.join( "" );

                this.#word.push( style );
                this.#ansiStyle += style;
            }
        }
        else {
            for ( const char of this.#ansiCode ) this.addChar( char );
        }

        this.#ansiCodeStarted = false;
        this.#ansiCode = [];
    }

    // XXX add styles to the line start
    // XXX increase line length
    // XXX check if word is empty
    #endWord ( char ) {

        // add whole word
        if ( this.#wordWrap && this.#wordVisibleLength <= this.#maxLength ) {

            // can not add whole word to the current line
            if ( this.#lineVisibleLength + this.#wordVisibleLength > this.#maxLength ) {

                // end current line
                this.#endLine( "\n" );

                // start new line
                this.#startLine();
            }

            this.#line += this.#word.join( "" );
            this.#lineVisibleLength += this.#wordVisibleLength;
        }

        // add word char-by-char
        else {
            let wordANSI = "";

            for ( let n = 0; n < this.#word.length; n++ ) {

                // ansi code
                if ( this.#word[n][0] === "\x1b" || this.#word[n][0] === "\u009b" ) {
                    wordANSI += this.#word[n];
                    this.#line += this.#word[n];
                }
                else {
                    if ( this.#lineVisibleLength >= this.#maxLength ) {
                        this.#endLine( "\n" );

                        // start new line
                        this.#startLine( wordANSI );
                    }

                    this.#line += this.#word[n];
                    this.#lineVisibleLength++;
                }
            }
        }

        this.#word = [];
        this.#wordVisibleLength = 0;

        // EOF / EOL
        if ( !char || char === "\n" ) {
            this.#endLine( char );
        }

        // end of the word
        // XXX what to do with the " ", add to line, check line length, respect trim setting
        else if ( char === " " ) {
            if ( this.#lineVisibleLength >= this.#maxLength ) {
                this.#endLine( "\n" );
                this.#startLine();
            }

            this.#line += char;
            this.#lineVisibleLength++;
        }
    }

    #startLine ( wordANSI ) {
        if ( this.#line.length === 0 ) this.#line += this.#ansiStyle + ( wordANSI ?? "" );
    }

    #endLine ( char ) {
        this.#output += this.#line;

        // reset ansi styles at line end
        if ( this.#line && this.#ansiStyle ) this.#output += "\x1b[49m";

        if ( char ) this.#output += char;

        this.#line = "";
        this.#lineVisibleLength = 0;
    }
}

export default function wrap ( string, maxLength, options = {} ) {
    const wrap = new Wrap( maxLength, options );

    return wrap.wrap( string );
}
