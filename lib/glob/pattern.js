import path from "node:path";
import micromatch from "micromatch";

const DEFAULT_OPTIONS = {
    "dot": true,
    "strictBrackets": true,
};

export default class GlobPattern {
    #pattern;
    #isCaseSensitive;
    #isNegated = false;
    #matcher;

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
        this.#pattern = micromatch.braces( this.#pattern )[ 0 ];

        // add prefix
        if ( prefix ) {
            prefix = this.constructor.quote( prefix );

            if ( prefix.endsWith( "/" ) && this.#pattern.startsWith( "/" ) ) {
                prefix = prefix.slice( 0, -1 );
            }

            this.#pattern = prefix + this.#pattern;
        }

        // parse and create matcher
        this.#matcher = micromatch.matcher( this.#pattern, {
            ...DEFAULT_OPTIONS,
            "nocase": !this.#isCaseSensitive,
            "prepend": prefix,
        } );

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
            micromatch.parse( pattern, {
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

    get isCaseSensitive () {
        return this.#isCaseSensitive;
    }

    get isNegated () {
        return this.#isNegated;
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
}
