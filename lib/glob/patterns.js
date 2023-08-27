import { quoteMeta } from "#lib/utils";
import path from "node:path";

const pathChar = `[^/]`,
    pathSegment = `(?:${pathChar}+)`,
    globstarSegment = `.*${pathChar}`;

const DEFAULT_IGNORE_PREFIX = "!";

const isGlobPatternRegExp = /[*?]/;

export class GlobPattern {
    #pattern;
    #isCaseSensitive;
    #isGlobPattern;
    #isIgnore;
    #compiled;
    #depth;
    #matchAll;
    #matchPattern;
    #unescapedPattern;
    #escapes = [];

    constructor ( pattern, { caseSensitive = true, prefix, relativeGlobstar } = {} ) {
        this.#isCaseSensitive = caseSensitive;

        if ( !this.#isCaseSensitive ) {
            pattern = pattern.toLowerCase();
        }

        // ignore pattern
        if ( pattern.startsWith( DEFAULT_IGNORE_PREFIX ) ) {
            this.#isIgnore = true;

            pattern = pattern.substring( DEFAULT_IGNORE_PREFIX.length );
        }
        else {
            this.#isIgnore = false;
        }

        // unescape
        pattern = pattern.replaceAll( /\\(.)/g, ( match, escape ) => {
            this.#escapes.push( escape );

            return "\0";
        } );

        // relativeGlobStar
        if ( !pattern.startsWith( "/" ) && relativeGlobstar && !pattern.startsWith( "**/" ) ) {
            pattern = "**/" + pattern;
        }

        // normalize
        this.#unescapedPattern = path.posix.join( "/", prefix || "", pattern, "." ).replaceAll( /\/\*\*(?:\/\*\*)+/g, "/**" );
    }

    // static
    static new ( pattern, { caseSensitive = true, prefix, relativeGlobstar } = {} ) {
        if ( pattern instanceof GlobPattern ) return pattern;

        return new this( pattern, { caseSensitive, prefix, relativeGlobstar } );
    }

    // properties
    get pattern () {
        if ( this.#pattern == null ) {

            // escape
            if ( this.#escapes.length ) {
                let id = 0;

                this.#pattern = this.#unescapedPattern.replaceAll( "\0", () => "\\" + this.#escapes[id++] );
            }
            else {
                this.#pattern = this.#unescapedPattern;
            }

            // add ignore prefix
            if ( this.#isIgnore ) this.#pattern = DEFAULT_IGNORE_PREFIX + this.#pattern;
        }

        return this.#pattern;
    }

    get isGlobPattern () {
        this.#isGlobPattern ??= isGlobPatternRegExp.test( this.#unescapedPattern );

        return this.#isGlobPattern;
    }

    get isCaseSensitive () {
        return this.#isCaseSensitive;
    }

    get isIgnore () {
        return this.#isIgnore;
    }

    get depth () {
        if ( !this.#compiled ) this.#compile();

        return this.#depth;
    }

    get matchAll () {
        if ( !this.#compiled ) this.#compile();

        return this.#matchAll;
    }

    get matchPattern () {
        if ( !this.#compiled ) this.#compile();

        return this.#matchPattern;
    }

    // public
    toString () {
        return this.pattern;
    }

    toJSON () {
        return this.toString();
    }

    // private
    #compile () {
        this.#compiled = true;

        if ( this.#unescapedPattern === "/**" ) {
            this.#matchAll = true;

            this.#depth = Infinity;
        }
        else if ( this.isGlobPattern ) {
            this.#matchPattern = quoteMeta( this.#unescapedPattern )

                // /**/
                .replaceAll( "/\\*\\*/", () => {
                    this.#depth = Infinity;

                    return `(?:/|/${globstarSegment}/)`;
                } )

                // /**
                .replaceAll( "/\\*\\*", () => {
                    this.#depth = Infinity;

                    return `(?:/|/${globstarSegment})`;
                } )

                // /*/
                .replaceAll( "/\\*/", `/${pathSegment}/` )

                // /*
                .replace( /\/\\\*/, `/${pathSegment}` )

                // path*, *path
                .replaceAll( "\\*", `${pathSegment}?` )

                // ?
                .replaceAll( "\\?", `${pathChar}` );

            // escape
            if ( this.#escapes.length ) {
                let id = 0;

                this.#matchPattern = this.#matchPattern.replaceAll( "\0", () => quoteMeta( this.#escapes[id++] ) );
            }
        }
        else {
            this.#matchPattern = this.#unescapedPattern;

            // escape
            if ( this.#escapes.length ) {
                let id = 0;

                this.#matchPattern = this.#matchPattern.replaceAll( "\0", () => this.#escapes[id++] );
            }
        }

        if ( !this.#depth ) {
            this.#depth = this.#unescapedPattern.split( "/" ).length - 1;
        }
    }
}

class GlobPatternsList {
    #caseSensitive;

    #depth = 0;
    #patterns = new Map();
    #staticPatterns = new Set();
    #hasGlobPatterns = false;
    #globRegExp;
    #matchAll = false;

    constructor ( caseSensitive ) {
        this.#caseSensitive = !!caseSensitive;
    }

    // properties
    get depth () {
        return this.#depth;
    }

    get matchAll () {
        return this.#matchAll;
    }

    get hasStaticPatterns () {
        return !!this.#staticPatterns.size;
    }

    get hasGlobPatterns () {
        return this.#hasGlobPatterns;
    }

    // public
    has ( pattern, { prefix, relativeGlobstar } = {} ) {
        if ( !pattern ) return false;

        pattern = this.#createPattern( pattern, prefix, relativeGlobstar );

        return this.#patterns.has( pattern.pattern );
    }

    add ( patterns, prefix, relativeGlobstar ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, prefix, relativeGlobstar );

            // already added
            if ( this.#patterns.has( pattern.pattern ) ) continue;

            this.#patterns.set( pattern.pattern, pattern );

            if ( pattern.depth > this.#depth ) this.#depth = pattern.depth;

            if ( pattern.matchAll ) {
                this.#matchAll = true;
            }
            else if ( pattern.isGlobPattern ) {
                this.#hasGlobPatterns = true;
                this.#globRegExp = null;
            }
            else {
                this.#staticPatterns.add( pattern.matchPattern );
            }
        }

        return this;
    }

    delete ( patterns, { prefix, relativeGlobstar } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, prefix, relativeGlobstar );

            pattern = this.#patterns.get( pattern.pattern );

            // not exists
            if ( !pattern ) continue;

            this.#patterns.delete( pattern.pattern );

            if ( pattern.matchAll ) {
                this.#matchAll = false;
            }
            else if ( pattern.isGlobPattern ) {
                this.#globRegExp = null;
            }
            else {
                this.#staticPatterns.delete( pattern.matchPattern );
            }
        }

        this.#depth = 0;
        this.#hasGlobPatterns = false;

        for ( const pattern of this.#patterns.values() ) {
            if ( pattern.depth > this.#depth ) this.#depth = pattern.depth;

            if ( pattern.globPattern ) this.#hasGlobPatterns = true;
        }

        return this;
    }

    clear () {
        this.#depth = 0;
        this.#patterns.clear();
        this.#staticPatterns.clear();
        this.#hasGlobPatterns = false;
        this.#globRegExp = null;
        this.#matchAll = false;
    }

    match ( path ) {
        if ( this.#matchAll ) return true;

        if ( this.#staticPatterns.has( path ) ) return true;

        if ( this.#hasGlobPatterns ) {
            this.#globRegExp ??= this.#globRegExp = this.#createRegExp();

            if ( this.#globRegExp.test( path ) ) return true;
        }

        return false;
    }

    toJSON () {
        return [...this.#patterns.keys()];
    }

    // private
    #createPattern ( pattern, prefix, relativeGlobstar ) {
        return GlobPattern.new( pattern, {
            prefix,
            relativeGlobstar,
            "caseSensitive": this.#caseSensitive,
        } );
    }

    #createRegExp () {
        const parts = [];

        for ( const pattern of this.#patterns.values() ) {
            if ( !pattern.isGlobPattern ) continue;

            if ( pattern.matchAll ) continue;

            parts.push( "(?:" + pattern.matchPattern + ")" );
        }

        if ( parts.length ) {
            return new RegExp( "^(?:" + parts.join( "|" ) + ")$" );
        }
    }
}

export default class GlobPatterns {
    #caseSensitive;
    #allowed;
    #ignored;

    constructor ( { caseSensitive = true } = {} ) {
        this.#caseSensitive = !!caseSensitive;

        this.#allowed = new GlobPatternsList( this.#caseSensitive );
        this.#ignored = new GlobPatternsList( this.#caseSensitive );
    }

    // static
    static isGlobPattern ( pattern ) {
        return GlobPattern.new( pattern ).isGlobPattern;
    }

    // properties
    get depth () {
        return this.#allowed.depth;
    }

    // public
    isGlobPattern ( pattern ) {
        return GlobPattern.new( pattern ).isGlobPattern;
    }

    has ( pattern, { prefix, relativeGlobstar } = {} ) {
        if ( !pattern ) return false;

        var list;

        [pattern, list] = this.#createPattern( pattern, prefix, relativeGlobstar );

        return list.has( pattern, { prefix, relativeGlobstar } );
    }

    add ( patterns, { prefix, relativeGlobstar } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [pattern, list] = this.#createPattern( pattern, prefix, relativeGlobstar );

            list.add( pattern, { prefix, relativeGlobstar } );
        }

        return this;
    }

    delete ( patterns, { prefix, relativeGlobstar } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [pattern, list] = this.#createPattern( pattern, prefix, relativeGlobstar );

            list.delete( pattern, { prefix, relativeGlobstar } );
        }

        return this;
    }

    clear () {
        this.#allowed.clear();
        this.#ignored.clear();
    }

    match ( string, { prefix } = {} ) {
        if ( !string ) return false;

        string = path.posix.join( "/", prefix || "", string, "." );

        if ( !this.#caseSensitive ) {
            string = string.toLowerCase();
        }

        return this.#allowed.match( string ) && !this.#ignored.match( string );
    }

    toJSON () {
        return [

            //
            ...this.#allowed.toJSON(),
            ...this.#ignored.toJSON().map( pattern => "!" + pattern ),
        ];
    }

    // private
    #createPattern ( pattern, prefix, relativeGlobstar ) {
        pattern = GlobPattern.new( pattern, {
            "caseSensitive": this.#caseSensitive,
            prefix,
            relativeGlobstar,
        } );

        let list;

        if ( pattern.isIgnore ) {
            list = this.#ignored;
        }
        else {
            list = this.#allowed;
        }

        return [pattern, list];
    }
}
