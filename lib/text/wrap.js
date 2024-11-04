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

    constructor ( maxLength, { trim, wordWrap } = {} ) {
        this.#maxLength = maxLength;
        this.#trim = trim;
        this.#wordWrap = wordWrap;
    }

    // public
    wrap ( string ) {
        const segments = SEGMENTER.segment( string );

        for ( const { "segment": char } of segments ) {
            if ( this.#ansiCodeStarted ) {
                this.#addAnsiCode( char );
            }
            else if ( char === "\x1B" || char === "\u009B" ) {
                this.#startAnsiCode( char );
            }
            else {
                this.#addChar( char );
            }
        }

        this.#endAnsiCode();
        this.#endWord();

        return this.#output;
    }

    // private
    #startAnsiCode ( char ) {
        this.#ansiCode.push( char );

        this.#ansiCodeStarted = true;
    }

    #addAnsiCode ( char ) {
        this.#ansiCode.push( char );

        const codePoint = char.charCodeAt( 0 );

        if ( char === "[" && this.#ansiCode.length === 2 && this.#ansiCode[ 0 ] === "\x1B" ) {
            return;
        }

        // escape sequence parameter
        else if ( ( codePoint >= 0x30 && codePoint <= 0x3F ) || ( codePoint >= 0x20 && codePoint <= 0x2F ) ) {
            return;
        }

        // end of the escape sequence
        else if ( codePoint >= 0x40 && codePoint <= 0x7E ) {
            this.#endAnsiCode( true );
        }

        // invalid escape sequence
        else {
            this.#endAnsiCode();
        }
    }

    #addChar ( char ) {

        // replace tab with the single space
        if ( char === "\t" ) char = " ";

        // new word
        if ( char === " " || char === "\n" ) {
            this.#endWord( char );
        }
        else {
            const codePoint = char.charCodeAt( 0 );

            // control character, ignore
            if ( codePoint <= 0x1F || ( codePoint >= 0x7F && codePoint <= 0x9F ) ) return;

            this.#word.push( char );
            this.#wordVisibleLength++;
        }
    }

    #endAnsiCode ( valid ) {
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
            let wordAnsi = "";

            for ( let n = 0; n < this.#word.length; n++ ) {

                // ansi code
                if ( this.#word[ n ][ 0 ] === "\x1B" || this.#word[ n ][ 0 ] === "\u009B" ) {
                    wordAnsi += this.#word[ n ];
                    this.#line += this.#word[ n ];
                }
                else {
                    if ( this.#lineVisibleLength >= this.#maxLength ) {
                        this.#endLine( "\n" );

                        // start new line
                        this.#startLine( wordAnsi );
                    }

                    this.#line += this.#word[ n ];
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
        else if ( char === " " ) {
            const eol = this.#lineVisibleLength >= this.#maxLength;

            if ( !eol || !this.#trim ) {

                // need to start new line
                if ( eol ) {
                    this.#endLine( "\n" );
                    this.#startLine();
                }

                this.#line += char;
                this.#lineVisibleLength++;
            }
        }
    }

    #startLine ( wordAnsi ) {
        if ( this.#line.length === 0 ) this.#line += this.#ansiStyle + ( wordAnsi ?? "" );
    }

    #endLine ( char ) {
        this.#output += this.#line;

        // reset ansi styles at line end
        if ( this.#line && this.#ansiStyle ) this.#output += "\x1B[0m";

        if ( char ) this.#output += char;

        this.#line = "";
        this.#lineVisibleLength = 0;
    }
}

export default function wrap ( string, maxLength, options = {} ) {
    const wrap = new Wrap( maxLength, options );

    return wrap.wrap( string );
}
