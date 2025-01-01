import path from "node:path";
import braces from "braces";
import picomatch from "picomatch";

const DEFAULT_OPTIONS = {
    "dot": true,
    "strictBrackets": true,
    "posix": true,
    "windows": false,

    // XXX
    // when true, picomatch won't match trailing slashes with single stars.
    // "strictSlashes": false,
};

export default class GlobPattern {
    #pattern;
    #isCaseSensitive;
    #isNegated = false;
    #isMatchAll;
    #matcher;
    #state;
    #scan;

    constructor ( pattern, { caseSensitive = true, prefix } = {} ) {
        if ( pattern instanceof GlobPattern ) {
            this.#pattern = pattern.pattern;
        }
        else {
            this.#pattern = pattern;
        }

        this.#isCaseSensitive = Boolean( caseSensitive );

        // negated pattern
        if ( this.constructor.isNegated( this.#pattern ) ) {
            this.#isNegated = true;

            this.#pattern = this.#pattern.slice( 1 );
        }

        // expand braces
        this.#pattern = braces( this.#pattern )[ 0 ];

        // add prefix
        if ( prefix ) {
            prefix = this.constructor.quote( prefix );

            if ( prefix.endsWith( "/" ) && this.#pattern.startsWith( "/" ) ) {
                prefix = prefix.slice( 0, -1 );
            }

            this.#pattern = prefix + this.#pattern;
        }

        // parse and create matcher
        this.#matcher = picomatch(
            this.#pattern,
            {
                ...DEFAULT_OPTIONS,
                "nocase": !this.#isCaseSensitive,
            },
            true
        );

        this.#state = this.#matcher.state;
        delete this.#matcher.state;

        if ( this.#isNegated ) {
            this.#pattern = "!" + this.#pattern;
        }
    }

    // static
    static new ( pattern, { caseSensitive, prefix } = {} ) {
        if ( pattern instanceof this ) {
            caseSensitive = Boolean( caseSensitive );

            if ( prefix || caseSensitive !== pattern.isCaseSensitive ) {
                return new this( pattern.pattern, { caseSensitive, prefix } );
            }
            else {
                return pattern;
            }
        }
        else {
            return new this( pattern, { caseSensitive, prefix } );
        }
    }

    static isValid ( pattern ) {
        if ( pattern instanceof GlobPattern ) {
            return true;
        }

        try {
            picomatch.parse( pattern, {
                ...DEFAULT_OPTIONS,
            } );

            return true;
        }
        catch {
            return false;
        }
    }

    static isNegated ( pattern ) {
        if ( pattern instanceof GlobPattern ) {
            return pattern.isNegated;
        }
        else {
            return pattern.startsWith( "!" );
        }
    }

    static quote ( string ) {
        string = string //
            .replaceAll( "\\", "/" )
            .replaceAll( "*", "\\*" )
            .replaceAll( "?", "\\?" )
            .replaceAll( "{", "\\{" )
            .replaceAll( "}", "\\}" )
            .replaceAll( "[", "\\[" )
            .replaceAll( "]", "\\]" )
            .replaceAll( "(", "\\(" )
            .replaceAll( "|", "\\|" )
            .replaceAll( ")", "\\)" );

        // quote start "!"
        if ( string.startsWith( "!" ) ) {
            string = "\\" + string;
        }

        return path.posix.normalize( string );
    }

    // properties
    get pattern () {
        return this.#pattern;
    }

    get regExpPattern () {
        return this.#state.output;
    }

    get isCaseSensitive () {
        return this.#isCaseSensitive;
    }

    get isNegated () {
        return this.#isNegated;
    }

    get isGlobPattern () {
        return Boolean( this.#getScan().glob );
    }

    // XXX
    get isMatchAll () {
        if ( this.#isMatchAll == null ) {
            const scan = this.#getScan();

            // is glob pattern
            if ( scan.glob ) {

                // has prefix
                if ( scan.base ) {
                    this.#isMatchAll = false;
                }

                // has no prefix
                else {
                    if ( scan.glob === "**" ) {
                        this.#isMatchAll = true;
                    }
                    else {
                        this.#isMatchAll = false;
                    }
                }
            }

            // is not glob pattern
            else {
                this.#isMatchAll = false;
            }
        }

        return this.#isMatchAll;
    }

    get prefix () {
        return this.#getScan().base;
    }

    // public
    test ( path ) {
        return this.#matcher( path );
    }

    toString () {
        return this.pattern;
    }

    toJSON () {
        return this.toString();
    }

    // private
    #getScan () {
        this.#scan ??= picomatch.scan( this.#pattern, {
            ...DEFAULT_OPTIONS,
            "nocase": !this.#isCaseSensitive,
            "tokens": false,
            "parts": false,
        } );

        return this.#scan;
    }
}
