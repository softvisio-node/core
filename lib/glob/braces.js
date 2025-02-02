import toRegexRange from "to-regex-range";
import { quoteMeta } from "#lib/utils";

// NOTE https://www.gnu.org/software/bash/manual/html_node/Brace-Expansion.html

export default class GlobBraces {
    #pattern;
    #maxNumbers;
    #n = 0;

    constructor ( pattern, { maxNumbers } = {} ) {
        this.#pattern = pattern;
        this.#maxNumbers = maxNumbers || 1000;
    }

    // public
    expand () {
        const state = {
            "pattern": "",
            "escape": false,
        };

        for ( this.#n; this.#n < this.#pattern.length; this.#n++ ) {
            const char = this.#pattern[ this.#n ];

            // escaped char
            if ( state.escape ) {
                state.escape = false;

                state.pattern += "\\" + char;
            }

            // escape
            else if ( char === "\\" ) {
                state.escape = true;
            }

            // braces start
            else if ( char === "{" ) {
                this.#n++;

                state.pattern += this.#processBraces();
            }

            // other character
            else {
                state.pattern += char;
            }
        }

        return state.pattern;
    }

    // private
    #processBraces () {
        const state = {
            "pattern": "",
            "escape": false,
            "patterns": [ "" ],
        };

        for ( this.#n; this.#n < this.#pattern.length; this.#n++ ) {
            const char = this.#pattern[ this.#n ];

            // escaped char
            if ( state.escape ) {
                state.escape = false;

                state.patterns[ state.patterns.length - 1 ] += "\\" + char;
            }

            // escape
            else if ( char === "\\" ) {
                state.escape = true;
            }

            // braces start
            else if ( char === "{" ) {
                this.#n++;

                state.patterns[ state.patterns.length - 1 ] += this.#processBraces();
            }

            // braces patterns separator
            else if ( char === "," ) {
                state.patterns.push( "" );
            }

            // "|"
            else if ( char === "|" ) {
                state.patterns[ state.patterns.length - 1 ] += "\\|";
            }

            // braces end
            else if ( char === "}" ) {
                state.pattern = this.#processPatterns( state.patterns );

                break;
            }

            // other character
            else {
                state.patterns[ state.patterns.length - 1 ] += char;
            }
        }

        return state.pattern;
    }

    // XXX
    #processPatterns ( patterns ) {

        // "{}"
        if ( patterns.length === 1 && patterns[ 0 ] === "" ) {
            return "{}";
        }

        // filter empty patterns
        patterns = patterns.filter( pattern => pattern );

        // "{,}", "{,,,}"
        if ( !patterns.length ) {
            return "";
        }
        else if ( patterns.length === 1 ) {

            // check sequence
            const match = patterns[ 0 ].match( /([+-])?(0*)?((?:\d+|.))\.\.([+-])?(0*)?((?:\d+|.))(?:\.\.[+-]?(\d+))?/ );

            // sequence
            if ( match ) {

                // parse sequence
                const pattern = this.#processSequence( match );

                // sequence is valid
                if ( pattern ) {
                    return pattern;
                }
            }

            // not a sequence
            // or sequence is not valid
            return this.#quotePattern( "{" + patterns[ 0 ] + "}" );
        }

        return "(?:" + patterns.join( "|" ) + ")";
    }

    #processSequence ( match ) {
        let startPrefix = match[ 2 ],
            start = match[ 3 ],
            endPrefix = match[ 5 ],
            end = match[ 6 ],
            step = match[ 7 ];

        const startSign = match[ 1 ],
            endSign = match[ 4 ];

        // prefix
        startPrefix ??= "";
        endPrefix ??= "";
        const prefix = startPrefix.length > endPrefix.length
            ? startPrefix
            : endPrefix;

        // step
        if ( step ) {
            step = Number( step );
        }
        else {
            step = 1;
        }

        // start
        if ( !Number.isNaN( Number( start ) ) ) {
            start = Number( start );

            if ( startSign === "-" ) {
                start = 0 - start;
            }
        }

        // end
        if ( !Number.isNaN( Number( end ) ) ) {
            end = Number( end );

            if ( endSign === "-" ) {
                end = 0 - end;
            }
        }

        // start and end must be both characters or numbers
        if ( typeof start !== typeof end ) {
            return;
        }

        // numeric sequence
        else if ( typeof start === "number" ) {
            return this.#processNunericSequence( start, end, step, prefix );
        }

        // characters sequence
        else {
            return this.#processCharsSequence( start, end, step, prefix );
        }
    }

    #processNunericSequence ( start, end, step, prefix ) {

        // single number sequence
        if ( start === end ) {
            return prefix + start;
        }

        // swap start <-> end
        if ( start > end ) {
            const _end = start;
            start = end;
            end = _end;
        }

        if ( step === 1 ) {
            return toRegexRange( prefix + start, prefix + end, {
                "capture": false,
                "shorthand": true,
                "relaxZeros": false,
            } );
        }
        else {
            const numbers = [],
                positive = new Set(),
                negative = new Set();

            let total = 0;

            for ( let n = start; n <= end; n += step ) {

                // negative
                if ( n < 0 ) {
                    const number = Math.abs( n );

                    if ( positive.has( number ) ) {
                        numbers.push( number );

                        positive.delete( number );
                    }
                    else {
                        negative.add( number );
                    }
                }

                // positive
                else {
                    if ( negative.has( n ) ) {
                        numbers.push( n );

                        negative.delete( n );
                    }
                    else {
                        positive.add( n );
                    }
                }

                if ( ++total >= this.#maxNumbers ) break;
            }

            const patterns = [];

            if ( negative.size ) {
                if ( negative.size === 1 ) {
                    patterns.push( `-${ prefix }` + [ ...negative ][ 0 ] );
                }
                else {
                    patterns.push( `-${ prefix }(?:` + [ ...negative ].sort().join( "|" ) + ")" );
                }
            }

            if ( positive.size ) {
                if ( positive.size === 1 ) {
                    patterns.push( prefix + [ ...positive ][ 0 ] );
                }
                else {
                    patterns.push( `${ prefix }(?:` + [ ...positive ].sort().join( "|" ) + ")" );
                }
            }

            if ( numbers.length ) {
                if ( numbers.length === 1 ) {
                    patterns.push( `-?${ prefix }` + numbers[ 0 ] );
                }
                else {
                    patterns.push( `-?${ prefix }(?:` + numbers.sort().join( "|" ) + ")" );
                }
            }

            if ( patterns.length === 1 ) {
                return patterns[ 0 ];
            }
            else {
                return "(?:" + patterns.join( "|" ) + ")";
            }
        }
    }

    #processCharsSequence ( start, end, step, prefix ) {

        // start and end must be ASCII characters
        if ( !/^[\x00-\x7F]$/.test( start ) || !/^[\x00-\x7F]$/.test( end ) ) {
            return;
        }

        // single char sequence
        if ( start === end ) {
            return prefix + this.#escapeCtrlChar( start );
        }

        start = start.charCodeAt( 0 );
        end = end.charCodeAt( 0 );

        // swap start <-> end
        if ( start > end ) {
            const _end = start;
            start = end;
            end = _end;
        }

        let range = "";

        if ( step === 1 ) {
            range = this.#escapeRangeChar( String.fromCharCode( start ) ) + "-" + this.#escapeRangeChar( String.fromCharCode( end ) );
        }
        else {
            for ( let n = start; n <= end; n += step ) {
                const char = String.fromCharCode( n );

                range += this.#escapeRangeChar( char );
            }
        }

        return prefix + "[" + range + "]";
    }

    #escapeCtrlChar ( char ) {
        if ( /[\x00-\x1F\x7F]/.test( char ) ) {
            return "\\x" + char.charCodeAt( 0 );
        }
        else {
            return char;
        }
    }

    #escapeRangeChar ( char ) {
        if ( /[\x00-\x1F\]^\x7F-]/.test( char ) ) {
            return "\\x" + char.charCodeAt( 0 );
        }
        else {
            return char;
        }
    }

    #quotePattern ( pattern ) {
        const state = {
            "pattern": "",
            "escape": false,
        };

        for ( let n = 0; n < pattern.length; n++ ) {
            const char = pattern[ n ];

            if ( state.escape ) {
                state.escape = false;

                state.pattern += "\\" + char;
            }
            else if ( char === "\\" ) {
                state.escape = true;
            }
            else {
                state.pattern += quoteMeta( char );
            }
        }

        if ( state.escape ) {
            pattern += "\\";
        }

        return state.pattern;
    }
}
