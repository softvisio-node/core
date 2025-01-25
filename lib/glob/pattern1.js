import path from "node:path";

const GLOBSTAR_PATTERNS = {
        "**": ".*",
        "/**": "/(?:.*[^/]|)",
        "**/": "(?:[^/].*|)/",
        "/**/": "/.*/",
    },
    MATCH_ALL_PATTERNS = new Set( [

        //
        "**",
        "!**",
    ] );

export default class GlobPattern {
    #id;
    #pattern;
    #caseSensitive;
    #allowNegated;
    #allowGlobstar;
    #allowBrackets;
    #allowBraces;
    #allowExtglob;
    #matchBasename;
    #isNegated = false;
    #isStatic = true;
    #isMatchAll;
    #regExp;

    constructor ( pattern, { prefix, caseSensitive = true, allowNegated = true, allowGlobstar = true, allowBrackets = true, allowBraces = true, allowExtglob = true, matchBasename } = {} ) {
        if ( pattern instanceof GlobPattern ) {
            this.#pattern = pattern.pattern;
        }
        else {
            this.#pattern = pattern;
        }

        this.#caseSensitive = Boolean( caseSensitive );
        this.#allowNegated = Boolean( allowNegated );
        this.#allowGlobstar = Boolean( allowGlobstar );
        this.#allowBrackets = Boolean( allowBrackets );
        this.#allowBraces = Boolean( allowBraces );
        this.#allowExtglob = Boolean( allowExtglob );
        this.#matchBasename = Boolean( matchBasename );

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

            // escape prefix
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

        // parse pattern
        this.#parse();

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

    static isValid ( pattern, options ) {
        if ( pattern instanceof GlobPattern ) {
            return true;
        }

        try {
            pattern = new this( pattern, options );

            return true;
        }
        catch {
            return false;
        }
    }

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
        return this.#regExp;
    }

    get isCaseSensitive () {
        return this.#caseSensitive;
    }

    get allowNegated () {
        return this.#allowNegated;
    }

    get allowGlobstar () {
        return this.#allowGlobstar;
    }

    get allowBrackets () {
        return this.#allowBrackets;
    }

    get allowBraces () {
        return this.#allowBraces;
    }

    get allowExtglob () {
        return this.#allowExtglob;
    }

    get matchBasename () {
        return this.#matchBasename;
    }

    get isNegated () {
        return this.#isNegated;
    }

    get isStatic () {
        return this.#isStatic;
    }

    get isMatchAll () {
        if ( this.#isMatchAll == null ) {
            if ( this.#allowGlobstar ) {
                this.#isMatchAll = MATCH_ALL_PATTERNS.has( this.#pattern );
            }
            else {
                this.#isMatchAll = false;
            }
        }

        return this.#isMatchAll;
    }

    // public
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

    // private
    // XXX
    #parse () {
        var pattern;

        if ( this.#allowGlobstar ) {
            pattern = GLOBSTAR_PATTERNS[ this.#pattern ];

            this.#isStatic = false;
        }

        if ( !pattern ) {
            const state = {
                "patterns": [],
                "pattern": "",
                "escape": false,
                "stack": [],
            };

            for ( let n = 0; n < this.#pattern.length; n++ ) {
                const char = this.#pattern[ n ];

                // escaped character
                if ( state.escape ) {
                    state.escape = false;

                    // XXX regexp escape char
                    state.pattern += char;
                }

                // "\" - escape
                else if ( char === "\\" ) {
                    state.escape = true;
                }

                // "/" - path separator
                else if ( char === "/" ) {

                    // XXX check stack
                    if ( state.stack.length ) {
                        throw new Error( "Glob pattern is not valid" );
                    }

                    if ( state.pattern ) {
                        state.patterns.push( state.pattern );
                    }

                    state.patterns.push( "/" );

                    state.pattern = "";
                    state.stack = [];
                }

                // "?"
                else if ( char === "?" ) {
                    state.pattern += "[^/]";
                }

                // XXX
                // "*"
                else if ( char === "*" ) {
                    const nextChar1 = this.#pattern[ n + 1 ];

                    if ( nextChar1 === "*" ) {

                        // XXX
                    }

                    state.pattern += "[^/]";
                }

                // other character
                else {

                    // XXX recognize glob patterns
                    state.pattern += char;
                }
            }

            // XXX check / add state

            console.log( this.#pattern );
            console.log( state );
            process.exit();
        }
    }
}
