import path from "node:path";
import { Minimatch } from "minimatch";

const DEFAULT_OPTIONS = {
        "dot": true,
        "nonegate": true,
        "nocomment": true,
        "magicalBraces": true,
    },
    MATCH_ALL_PATTERNS = new Set( [

        //
        "**",
        "/**",
        "!**",
        "!/**",
    ] );

export default class GlobPattern {
    #id;
    #pattern;
    #caseSensitive;
    #allowNegated;
    #allowBraces;
    #allowExtglob;
    #isNegated = false;
    #isStatic;
    #isMatchAll;
    #minimatch;
    #regExp;

    constructor ( pattern, { prefix, caseSensitive = true, allowNegated = true, allowBraces = true, allowExtglob = true } = {} ) {
        if ( pattern instanceof GlobPattern ) {
            this.#pattern = pattern.pattern;
        }
        else {
            this.#pattern = pattern;
        }

        this.#caseSensitive = Boolean( caseSensitive );
        this.#allowNegated = Boolean( allowNegated );
        this.#allowBraces = Boolean( allowBraces );
        this.#allowExtglob = Boolean( allowExtglob );

        // negated pattern
        if ( this.#allowNegated && this.#pattern.startsWith( "!" ) ) {
            if ( !this.#allowExtglob || !this.#pattern.startsWith( "!(" ) ) {
                this.#isNegated = true;

                this.#pattern = this.#pattern.slice( 1 );
            }
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

        this.#minimatch = new Minimatch( this.#pattern, {
            ...DEFAULT_OPTIONS,
            "nocase": !this.#caseSensitive,
            "nobrace": !this.#allowBraces,
            "noext": !this.#allowExtglob,
            "noglobstar": false,
        } );

        // build regular expression
        this.#minimatch.makeRe();

        // add negated sign
        if ( this.#isNegated ) {
            this.#pattern = "!" + this.#pattern;
        }

        // create id
        if ( this.#caseSensitive ) {
            this.#id = this.regExp.source;
        }
        else {
            this.#id = this.regExp.source.toLowerCase();
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
            new Minimatch( pattern, {
                ...DEFAULT_OPTIONS,
            } );

            return true;
        }
        catch {
            return false;
        }
    }

    // XXX
    static normalizePath ( string, { prefix, normalize } = {} ) {
        if ( normalize ) {
            return path.posix.normalize( ( ( prefix || "" ) + string ).replaceAll( "\\", "/" ) );
        }
        else if ( prefix ) {
            return prefix + string;
        }
        else {
            return string;
        }
    }

    // properties
    get id () {
        return this.#id;
    }

    get pattern () {
        return this.#pattern;
    }

    get regExp () {
        if ( this.#regExp == null ) {
            if ( this.isMatchAll ) {
                this.#regExp = new RegExp( ".+" );
            }
            else {
                this.#regExp = this.#minimatch.regexp;
            }
        }

        return this.#regExp;
    }

    get isCaseSensitive () {
        return this.#caseSensitive;
    }

    get allowNegated () {
        return this.#allowNegated;
    }

    get allowBraces () {
        return this.#allowBraces;
    }

    get allowExtglob () {
        return this.#allowExtglob;
    }

    get isNegated () {
        return this.#isNegated;
    }

    get isStatic () {
        this.#isStatic ??= this.#minimatch.hasMagic();

        return this.#isStatic;
    }

    // XXX advanced parsing
    get isMatchAll () {
        if ( this.#isMatchAll == null ) {
            this.#isMatchAll = MATCH_ALL_PATTERNS.has( this.#pattern );
        }

        return this.#isMatchAll;
    }

    // public
    // XXX normalize
    // XXX prefix
    test ( string, { prefix, normalize, ignoreNegated } = {} ) {
        var res;

        if ( !string ) {
            return false;
        }
        else if ( this.isMatchAll ) {
            res = true;
        }
        else {
            string = this.constructor.normalizePath( string, { prefix, normalize } );

            res = this.regExp.test( string );
        }

        if ( !ignoreNegated && this.#isNegated ) {
            return !res;
        }
        else {
            return res;
        }
    }

    toString () {
        return this.pattern;
    }

    toJSON () {
        return this.toString();
    }
}
