import path from "node:path";
import { quoteMeta } from "#lib/utils";

const GLOBSTAR_PATTERNS = {
        "**": ".*",
        "/**": "/(?:.*[^/]|)",
        "**/": "(?:[^/].*|)/",
        "/**/": "/.*/",
    },
    EXTGLOB_START_CHAR = new Set( [ "!", "@", "*", "?", "+" ] ),
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

            // XXX braces expansion
            // https://www.gnu.org/software/bash/manual/html_node/Brace-Expansion.html
            if ( this.#allowBraces ) {

                // XXX
            }

            const state = {
                "patterns": [],
                "pattern": "",
                "escape": false,
                "brackets": null,
                "extglob": [],
            };

            for ( let n = 0; n < this.#pattern.length; n++ ) {
                const char = this.#pattern[ n ];

                // escaped character
                if ( state.escape ) {
                    state.escape = false;

                    // inside brackets
                    if ( state.brackets != null ) {
                        state.brackets += char;
                    }

                    // not inside brackets
                    else {
                        state.pattern += quoteMeta( char );
                    }
                }

                // "\" - escape
                else if ( char === "\\" ) {
                    state.escape = true;
                }

                // XXX
                // brackets started
                else if ( state.brackets != null ) {

                    // brackets end
                    if ( char === "]" ) {

                        // XXX compile brackets
                        state.brackets = null;
                    }
                    else {
                        state.brackets += char;
                    }
                }

                // brackets start
                else if ( char === "[" && this.#allowBrackets ) {
                    state.brackets = "";

                    this.#isStatic = false;
                }

                // extglob start
                else if ( this.#allowExtglob && EXTGLOB_START_CHAR.has( char ) && this.#pattern[ n + 1 ] === "(" ) {
                    state.extglob.push( char );

                    this.#isStatic = false;

                    n += 1;

                    // negative look-ahead
                    if ( char === "!" ) {
                        state.pattern += "(?:(?<!";
                    }
                    else {
                        state.pattern += "(?:";
                    }
                }

                // extglob patterns separator
                else if ( char === "|" && state.extglob.length ) {

                    // XXX check sub-pattern not empty

                    state.pattern += "|";
                }

                // extglob end
                else if ( char === ")" && state.extglob.length ) {
                    const quantifier = state.extglob.pop();

                    // XXX check extglob pattern not empty

                    if ( quantifier === "!" ) {
                        state.pattern += ")[^/]*)";
                    }
                    else if ( quantifier === "@" ) {
                        state.pattern += ")";
                    }
                    else {
                        state.pattern += ")" + quantifier;
                    }
                }

                // "?"
                else if ( char === "?" ) {
                    state.pattern += "[^/]";

                    this.#isStatic = false;
                }

                // "*"
                else if ( char === "*" ) {
                    let stars = char;

                    // grab all consequtive "*"
                    while ( true ) {
                        if ( this.#pattern[ n + 1 ] === "*" ) {
                            stars += "*";

                            n += 1;
                        }
                        else {
                            break;
                        }
                    }

                    // * - single star
                    if ( stars.length === 1 ) {
                        this.#isStatic = false;

                        // segment match: */..., /*/..., .../*/, .../*
                        if ( state.pattern === "" && ( this.#pattern[ n + 1 ] === "/" || this.#pattern[ n + 1 ] == null ) ) {
                            state.pattern += "[^/]+";
                        }
                        else {
                            state.pattern += "[^/]*";
                        }
                    }

                    // ** - globstar
                    else if ( stars.length === 2 && this.#allowGlobstar ) {

                        // globstar is not allowed in extglob
                        if ( state.extglob.length ) {
                            state.pattern += "\\*\\*";
                        }

                        // globstar: **/..., /**/..., .../**/, .../**
                        else if ( state.pattern === "" && ( this.#pattern[ n + 1 ] === "/" || this.#pattern[ n + 1 ] == null ) ) {
                            this.#isStatic = false;

                            state.pattern += ".*";
                        }

                        // not a globstar
                        else {
                            state.pattern += "\\*\\*";
                        }
                    }

                    // ***...
                    else {
                        state.pattern += stars.replaceAll( "*", "\\\\*" );
                    }
                }

                // "/" - path separator
                else if ( char === "/" ) {

                    // inside extglob
                    if ( state.extglob.length ) {
                        state.pattern += "/";
                    }

                    // path separator
                    else {
                        if ( state.pattern ) {
                            state.patterns.push( state.pattern );
                        }

                        state.patterns.push( "/" );

                        state.pattern = "";
                    }
                }

                // other character
                else {
                    state.pattern += quoteMeta( char );
                }
            }

            // XXX check && add state
            // XXX check extglob closed
            // XXX escape === true - error
            // XXX brackets !== null - error

            console.log( this.#pattern );
            console.log( state );
            process.exit();
        }
    }
}
