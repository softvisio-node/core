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
    #globPattern;

    constructor ( pattern, { caseSensitive = true, prefix, relativeGlobstar } = {} ) {
        this.#isCaseSensitive = caseSensitive;

        if ( !this.#isCaseSensitive ) {
            pattern = pattern.toLowerCase();
        }

        if ( pattern.startsWith( DEFAULT_IGNORE_PREFIX ) ) {
            this.#isIgnore = true;

            pattern = pattern.substring( DEFAULT_IGNORE_PREFIX.length );
        }
        else {
            this.#isIgnore = false;
        }

        if ( !pattern.startsWith( "/" ) && relativeGlobstar && !pattern.startsWith( "**/" ) ) {
            pattern = "**/" + pattern;
        }

        pattern = path.posix.join( "/", prefix || "", pattern, "." );

        this.#pattern = pattern.replaceAll( /\/\*\*(?:\/\*\*)+/g, "/**" );
    }

    // static
    // XXX
    new ( pattern, { caseSensitive = true, prefix, relativeGlobstar } = {} ) {
        if ( pattern instanceof GlobPattern ) {
            if ( pattern.caseSensitive === caseSensitive ) {
                return pattern;
            }
            else {
                pattern = pattern.pattern;
            }
        }

        return new this( pattern, { caseSensitive, prefix, relativeGlobstar } );
    }

    // properties
    // XXX escaped
    get pattern () {
        return this.#pattern;
    }

    get isGlobPattern () {
        this.#isGlobPattern ??= isGlobPatternRegExp.test( this.#pattern );

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

    // XXX unescaped
    get staticPattern () {
        return null;
    }

    get globPattern () {
        if ( !this.#compiled ) this.#compile();

        return this.#globPattern;
    }

    // public
    toString () {
        return this.#pattern;
    }

    toJSON () {
        return this.toString();
    }

    // private
    #compile () {
        this.#compiled = true;

        if ( this.#pattern === "/**" ) {
            this.#matchAll = true;

            this.#depth = Infinity;
        }
        else if ( this.isGlobPattern ) {
            this.#globPattern = quoteMeta( this.#pattern )

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
        }

        if ( !this.#depth ) {
            this.#depth = this.#pattern.split( "/" ).length - 1;
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
            else if ( pattern.globPattern ) {
                this.#hasGlobPatterns = true;
                this.#globRegExp = null;
            }
            else {
                this.#staticPatterns.add( pattern.pattern );
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
            else if ( pattern.globPattern ) {
                this.#globRegExp = null;
            }
            else {
                this.#staticPatterns.delete( pattern.pattern );
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
            if ( !pattern.globPattern ) continue;

            if ( pattern.matchAll ) continue;

            parts.push( "(?:" + pattern.globPattern + ")" );
        }

        if ( parts.length ) {
            return new RegExp( "^(?:" + parts.join( "|" ) + ")$" );
        }
    }
}

export default class GlobPatterns {
    #ignore;
    #caseSensitive;
    #allowed;
    #ignored;

    constructor ( { ignore, caseSensitive = true } = {} ) {
        this.#ignore = !!ignore;
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
        if ( this.#ignore ) {
            return this.#ignored.depth;
        }
        else {
            return this.#allowed.depth;
        }
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

        if ( !this.#ignore ) {
            if ( this.#allowed.match( string ) && !this.#ignored.match( string ) ) return true;
        }
        else {
            if ( this.#ignored.match( string ) && !this.#allowed.match( string ) ) return true;
        }

        return false;
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
            list = this.#ignore ? this.#allowed : this.#ignored;
        }
        else {
            list = this.#ignore ? this.#ignored : this.#allowed;
        }

        return [pattern, list];
    }
}
