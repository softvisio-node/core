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
        this.#pattern = pattern;
        this.#isCaseSensitive = Boolean( caseSensitive );

        // negated pattern
        if ( this.#pattern.startsWith( "!" ) ) {
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
    static new ( pattern, options ) {
        if ( pattern instanceof this ) {
            return pattern;
        }
        else {
            return new this( pattern, options );
        }
    }

    static isValid ( pattern ) {
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

    static quote ( pattern ) {
        pattern = pattern //
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
        if ( pattern.startsWith( "!" ) ) {
            pattern = "\\" + pattern;
        }

        return path.posix.normalize( pattern );
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
