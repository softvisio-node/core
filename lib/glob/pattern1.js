import path from "node:path";
import { quoteMeta } from "#lib/utils";
import GlobBraces from "./braces.js";

// XXX
const GLOBSTAR_PATTERNS = {
        "**": ".*",
        "/**": "/(?:.*[^/]|)",
        "**/": "(?:[^/].*|)/",
        "/**/": "/.*/",
    },
    EXTGLOB_START_CHAR = new Set( [ "!", "@", "*", "?", "+" ] );

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
    #isMatchAll = false;
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
    // XXX add special cases for globstars
    // XXX set isStatic - ???
    #parse () {
        var pattern;

        if ( this.#allowGlobstar ) {
            pattern = GLOBSTAR_PATTERNS[ this.#pattern ];

            if ( pattern === "**" ) {
                this.#isMatchAll = true;
            }
        }

        if ( !pattern ) {

            // XXX
            pattern = this.#escape();

            // pattern = this.#pattern;

            if ( this.#allowBraces ) pattern = this.#expandBraces( pattern );

            if ( this.#allowBrackets ) pattern = this.#expandBrackets( pattern );

            if ( this.#allowExtglob ) pattern = this.#expandExtglob( pattern );

            pattern = this.#expandGlob( pattern );
        }

        this.#regExp = new RegExp( pattern, this.#caseSensitive
            ? ""
            : "i" );

        console.log( this.#pattern );
        console.log( pattern );
        process.exit();
    }

    // XXX
    #escape () {
        const state = {
            "pattern": "",
            "escape": false,
            "stack": [],
        };

        // escape meta characters
        for ( let n = 0; n < this.#pattern.length; n++ ) {
            const char = this.#pattern[ n ];

            if ( char === "\0" ) {
                throw new Error( "Glob pattern is not valid" );
            }

            // escaped character
            else if ( state.escape ) {
                state.escape = false;

                // XXX escape chars depends on stack
                state.pattern += "\\" + char;
            }

            // escape
            else if ( char === "\\" ) {
                state.escape = true;
            }

            // extglob
            else if ( EXTGLOB_START_CHAR.has( char ) && this.#pattern[ n + 1 ] === "(" ) {
                n += 1;

                if ( this.#allowExtglob ) {
                    state.pattern += char + "(";

                    state.stack.push( "(" );
                }
                else {
                    state.pattern += "\\" + char + "\\(";
                }
            }
            else if ( char === ")" ) {
                if ( state.stack.at( -1 ) === "(" ) {
                    state.pattern += ")";

                    state.stack.pop();
                }
                else {
                    state.pattern += "\\)";
                }
            }
            else if ( char === "|" ) {
                if ( state.stack.at( -1 ) === "(" ) {
                    state.pattern += "|";
                }
                else {
                    state.pattern += "\\|";
                }
            }

            // brackets
            else if ( char === "[" ) {
                if ( this.#allowBrackets ) {
                    state.pattern += "[";

                    state.stack.push( "[" );
                }
                else {
                    state.pattern += "\\[";
                }
            }
            else if ( char === "]" ) {
                if ( state.stack.at( -1 ) === "[" ) {
                    state.pattern += "]";

                    state.stack.pop();
                }
                else {
                    state.pattern += "\\]";
                }
            }

            // braces
            else if ( char === "{" ) {
                if ( this.#allowBraces ) {
                    state.pattern += "{";

                    state.stack.push( "{" );
                }
                else {
                    state.pattern += "\\{";
                }
            }
            else if ( char === "}" ) {
                if ( state.stack.at( -1 ) === "{" ) {
                    state.pattern += "}";

                    state.stack.pop();
                }
                else {
                    state.pattern += "\\}";
                }
            }
            else if ( char === "," ) {
                if ( state.stack.at( -1 ) === "{" ) {
                    state.pattern += ",";
                }
                else {
                    state.pattern += "\\,";
                }
            }

            // glob chars
            else if ( char === "?" || char === "*" ) {
                state.pattern += "\0" + char;
            }

            // other character
            else {
                state.pattern += quoteMeta( char );
            }
        }

        if ( state.escape ) {
            throw new Error( "Glob pattern contains unclosed escape" );
        }
        else if ( state.stack.length ) {
            throw new Error( "Glob pattern contains unclosed braces" );
        }

        return state.pattern;
    }

    // XXX
    // https://www.gnu.org/software/bash/manual/html_node/Brace-Expansion.html
    #expandBraces ( pattern ) {
        return new GlobBraces( pattern ).expand();
    }

    // XXX exclude "/" from ranges
    // XXX process [!...]
    #expandBrackets ( pattern ) {
        return pattern;
    }

    // XXX check how "!(...)" works in bash
    #expandExtglob ( pattern ) {
        const state = {
            "pattern": "",
            "escape": false,
            "stack": [],
        };

        for ( let n = 0; n < pattern.length; n++ ) {
            const char = pattern[ n ];

            // "/" inside extglob
            if ( char === "/" && state.stack.length ) {
                throw new Error( "Extglob pattern should not contain path separator" );
            }

            // escaped character
            else if ( state.escape ) {
                state.escape = false;

                state.pattern += "\\" + char;
            }

            // escape
            else if ( char === "\\" ) {
                state.escape = true;
            }

            // extglob start
            else if ( EXTGLOB_START_CHAR.has( char ) && this.#pattern[ n + 1 ] === "(" ) {
                n += 1;

                state.stack.push( char );

                if ( char === "!" ) {
                    state.pattern += "(?<!";
                }
                else {
                    state.pattern += "(?:";
                }
            }

            // extglob end
            else if ( char === ")" && state.stack.length ) {
                const quantifier = state.stack.pop();

                if ( quantifier === "!" ) {
                    state.pattern += ")[^/]*";
                }
                else if ( quantifier === "@" ) {
                    state.pattern += ")";
                }
                else {
                    state.pattern += ")" + quantifier;
                }
            }
            else {
                state.pattern += char;
            }
        }

        return state.pattern;
    }

    // XXX replace ?
    // XXX replace *, stack ***
    // XXX replace **
    // XXX split to segments
    // XXX calc isBasename, create pattern for matchBasename
    #expandGlob ( pattern ) {

        // "?"
        pattern = pattern.replaceAll( "\0?", "[^/]" );

        if ( this.#allowGlobstar ) {

            // "^**$"
            pattern = pattern.replace( /^\0\*\0\*$/, ".*" );

            // "^**/"
            pattern = pattern.replace( /^\0\*\0\*\//, ".*/" );

            // "^/**"
            pattern = pattern.replace( /^\/\0\*\0\*/, "/.*" );
        }

        // "*"
        pattern = pattern.replaceAll( /(?:\0\*)+/, "[^/]*" );

        return pattern;
    }
}
