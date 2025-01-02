import path from "node:path";
import { Minimatch } from "minimatch";

const DEFAULT_OPTIONS = {
    "dot": true,
    "nonegate": true,
    "nocomment": true,
    "magicalBraces": true,
};

export default class GlobPattern {
    #id;
    #pattern;
    #isCaseSensitive;
    #allowNegated;
    #allowBraces;
    #allowExtglob;
    #isNegated = false;
    #isMatchAll;
    #minimatch;

    constructor ( pattern, { prefix, caseSensitive = true, allowNegated = true, allowBraces = true, allowExtglob = true } = {} ) {
        if ( pattern instanceof GlobPattern ) {
            this.#pattern = pattern.pattern;
        }
        else {
            this.#pattern = pattern;
        }

        this.#isCaseSensitive = Boolean( caseSensitive );
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
            "nocase": !this.#isCaseSensitive,
            "nobrace": !this.#allowBraces,
            "noext": !this.#allowExtglob,
            "noglobstar": false,
        } );

        this.#minimatch.makeRe();

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
            new Minimatch( pattern, {
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
            return this.#minimatch.regexp.source;
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

    get allowExtglob () {
        return this.#allowExtglob;
    }

    get isNegated () {
        return this.#isNegated;
    }

    // XXX rename
    get isGlobPattern () {
        return this.#minimatch.hasMagic();
    }

    // XXX
    get isMatchAll () {
        if ( this.#isMatchAll == null ) {
            this.#isMatchAll = this.#pattern === "**";
        }

        return this.#isMatchAll;
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
            return this.#minimatch.regexp.test( path );
        }
    }

    toString () {
        return this.pattern;
    }

    toJSON () {
        return this.toString();
    }
}
