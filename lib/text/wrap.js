const SEGMENTER = new Intl.Segmenter( "en", { "granularity": "grapheme" } );

class Wrap {
    #maxLength;
    #trim;
    #wordWrap;

    #output = "";
    #ansiCodeStarted;
    #word = [];
    #wordLength = 0;
    #line = "";
    #lineLength = 0;
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
        this.#endLine();

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

        // new line
        if ( char === "\n" ) {
            this.#endLine( char );
        }

        // new word
        else if ( char === " " ) {
            this.#endWord( char );
        }
        else {
            const codePoint = char.charCodeAt( 0 );

            // control character, ignore
            if ( codePoint <= 0x1f || ( codePoint >= 0x7f && codePoint <= 0x9f ) ) return;

            this.#word.push( char );
            this.#wordLength++;
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

        // does not require word wrap
        if ( this.#lineLength + this.#wordLength <= this.#maxLength ) {
            this.#line += this.#word.join( "" );
        }
        else {

            //
        }

        this.#word = [];
        this.#wordLength = 0;
    }

    #endLine ( char ) {
        this.#output += this.#line;

        // reset ansi styles at line end
        if ( this.#line && this.#ansiStyle ) this.#output += "\x1b[49m";

        if ( char ) this.#output += char;

        this.#line = "";
        this.#lineLength = 0;
    }
}

export default function wrap ( string, maxLength, options = {} ) {
    const wrap = new Wrap( maxLength, options );

    return wrap.wrap( string );
}
