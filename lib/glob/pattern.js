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
    #isNegated = false;
    #isMatchAll;
    #matcher;
    #state;
    #scan;

    constructor ( pattern, { caseSensitive = true, allowBraces = true, allowBrackets = true, allowExtglob = true, prefix } = {} ) {
        if ( pattern instanceof GlobPattern ) {
            this.#pattern = pattern.pattern;
        }
        else {
            this.#pattern = pattern;
        }

        this.#isCaseSensitive = Boolean( caseSensitive );

        // negated pattern
        if ( this.constructor.isNegated( this.#pattern ) && !this.#pattern.startsWith( "!(" ) ) {
            this.#isNegated = true;

            this.#pattern = this.#pattern.slice( 1 );
        }

        // expand braces
        this.#pattern = expandBraces( this.#pattern )[ 0 ];

        // add prefix
        if ( prefix ) {
            prefix = this.constructor.quote( prefix );

            if ( prefix.endsWith( "/" ) && this.#pattern.startsWith( "/" ) ) {
                prefix = prefix.slice( 0, -1 );
            }

            this.#pattern = prefix + this.#pattern;
        }

        const options = {
            ...DEFAULT_OPTIONS,

            "nocase": !this.#isCaseSensitive,
            "nobrace": !allowBraces,
            "nobracket": !allowBrackets,
            "noextglob": !allowExtglob,

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

        if ( this.#isNegated ) {
            this.#pattern = "!" + this.#pattern;
        }
        else if ( this.#pattern.startsWith( "!" ) && !this.#pattern.startsWith( "!(" ) ) {
            this.#pattern = "\\" + this.#pattern;
        }

        // create id
        if ( !this.#isCaseSensitive ) {
            this.#id = this.regExpPattern.toLowerCase();
        }
        else {
            this.#id = this.regExpPattern;
        }
    }

    // static
    // XXX
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

    get isNegated () {
        return this.#isNegated;
    }

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
