import path from "node:path";
import expandBraces from "braces";
import picomatch from "picomatch";

const DEFAULT_OPTIONS = {
    "dot": true,
    "nonegate": true,
    "strictBrackets": true,
    "posix": true,
    "windows": false,

    // XXX
    // when true, picomatch won't match trailing slashes with single stars.
    // "strictSlashes": false,
};

export default class GlobPattern {
    #id;
    #pattern;
    #isCaseSensitive;
    #allowNegated;
    #allowBraces;
    #allowBrackets;
    #allowExtglob;
    #isNegated = false;
    #isMatchAll;
    #matcher;
    #state;
    #scan;

    constructor ( pattern, { prefix, caseSensitive = true, allowNegated = true, allowBraces = true, allowBrackets = true, allowExtglob = true } = {} ) {
        if ( pattern instanceof GlobPattern ) {
            this.#pattern = pattern.pattern;
        }
        else {
            this.#pattern = pattern;
        }

        this.#isCaseSensitive = Boolean( caseSensitive );
        this.#allowNegated = Boolean( allowNegated );
        this.#allowBraces = Boolean( allowBraces );
        this.#allowBrackets = Boolean( allowBrackets );
        this.#allowExtglob = Boolean( allowExtglob );

        // negated pattern
        if ( this.#allowNegated && this.#pattern.startsWith( "!" ) ) {
            if ( !this.#allowExtglob || !this.#pattern.startsWith( "!(" ) ) {
                this.#isNegated = true;

                this.#pattern = this.#pattern.slice( 1 );
            }
        }

        // expand braces
        if ( this.#allowBraces ) {
            this.#pattern = expandBraces( this.#pattern, {
                "quantifiers": false,
                "keepEscaping": false,
            } )[ 0 ];
        }

        // add prefix
        if ( prefix ) {
            prefix = prefix.replaceAll( "\\", "/" );

            prefix = path.posix.normalize( prefix );

            prefix = prefix //
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
            if ( prefix.startsWith( "!" ) ) {
                prefix = "\\" + prefix;
            }

            if ( prefix.endsWith( "/" ) && this.#pattern.startsWith( "/" ) ) {
                prefix = prefix.slice( 0, -1 );
            }

            this.#pattern = prefix + this.#pattern;
        }

        const options = {
            ...DEFAULT_OPTIONS,

            "nocase": !this.#isCaseSensitive,
            "nobrace": !this.#allowBraces,
            "nobracket": !this.#allowBrackets,
            "noextglob": !this.#allowExtglob,

            // scan options
            "tokens": false,
            "parts": false,
        };

        // parse and create matcher
        this.#matcher = picomatch( this.#pattern, options, true );

        this.#state = this.#matcher.state;
        delete this.#matcher.state;

        // scan
        this.#scan = picomatch.scan( this.#pattern, options );

        // add negated sign
        if ( this.#isNegated ) {
            this.#pattern = "!" + this.#pattern;
        }

        // create id
        if ( this.#isCaseSensitive ) {
            this.#id = this.regExpPattern;
        }
        else {
            this.#id = this.regExpPattern.toLowerCase();
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

    // properties
    get id () {
        return this.#id;
    }

    get pattern () {
        return this.#pattern;
    }

    get regExpPattern () {
        if ( this.isMatchAll ) {
            return ".+";
        }
        else {
            return this.#state.output;
        }
    }

    get isCaseSensitive () {
        return this.#isCaseSensitive;
    }

    get allowNegated () {
        return this.#allowNegated;
    }

    get allowBraces () {
        return this.#allowBraces;
    }

    get allowBrackets () {
        return this.#allowBrackets;
    }

    get allowExtglob () {
        return this.#allowExtglob;
    }

    get isNegated () {
        return this.#isNegated;
    }

    // XXX rename
    get isGlobPattern () {
        return Boolean( this.#scan.glob );
    }

    get isMatchAll () {
        if ( this.#isMatchAll == null ) {
            const scan = this.#scan;

            if ( !scan.base && scan.glob === "**" ) {
                this.#isMatchAll = true;
            }
            else {
                this.#isMatchAll = false;
            }
        }

        return this.#isMatchAll;
    }

    get prefix () {
        return this.#scan.base;
    }

    // public
    test ( path ) {
        if ( !path ) {
            return false;
        }
        else if ( this.isMatchAll ) {
            return true;
        }
        else {
            return this.#matcher( path );
        }
    }

    toString () {
        return this.pattern;
    }

    toJSON () {
        return this.toString();
    }
}
