import { quoteMeta } from "#lib/utils";
import path from "node:path";

const pathChar = `[^/]`,
    pathSegment = `(?:${pathChar}+)`,
    globstarSegment = `.*${pathChar}`;

const DEFAULT_IGNORE_PREFIX = "!";

const isGlobPatternRegExp = /[*?]/;

function isGlobPattern ( pattern ) {
    return isGlobPatternRegExp.test( pattern );
}

class GlobPatternsList {
    #relativeGlobstar;
    #caseSensitive;
    #matchPaths = new Set();
    #matchPatterns = new Map();
    #matchPatternsRegExp;
    #matchAll = false;
    #depth = 0;

    constructor ( relativeGlobstar, caseSensitive ) {
        this.#relativeGlobstar = !!relativeGlobstar;
        this.#caseSensitive = !!caseSensitive;
    }

    // properties
    get depth () {
        return this.#depth;
    }

    // public
    has ( pattern, prefix, relativeGlobstar ) {
        if ( !pattern ) return false;

        pattern = this.#normalizePattern( pattern, prefix, relativeGlobstar );

        if ( !isGlobPattern( pattern ) ) {
            return this.#matchPaths.has( pattern );
        }
        else {
            return this.#matchPatterns.has( pattern );
        }
    }

    add ( patterns, prefix, relativeGlobstar ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#normalizePattern( pattern, prefix, relativeGlobstar );

            if ( !isGlobPattern( pattern ) ) {
                this.#matchPaths.add( pattern );
            }
            else if ( !this.#matchPatterns.has( pattern ) ) {
                this.#matchPatterns.set( pattern, this.#compilePattern( pattern ) );

                this.#matchPatternsRegExp = null;

                if ( pattern === "/**" ) this.#matchAll = true;
            }
        }

        return this;
    }

    delete ( patterns, prefix, relativeGlobstar ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#normalizePattern( pattern, prefix, relativeGlobstar );

            if ( !isGlobPattern( pattern ) ) {
                this.#matchPaths.delete( pattern );
            }
            else if ( this.#matchPatterns.has( pattern ) ) {
                this.#matchPatterns.delete( pattern );

                this.#matchPatternsRegExp = null;

                if ( pattern === "/**" ) this.#matchAll = false;
            }
        }

        return this;
    }

    clear () {
        this.#matchPaths.clear();
        this.#matchPatterns.clear();
        this.#matchPatternsRegExp = null;
        this.#matchAll = false;
    }

    match ( path ) {
        if ( this.#matchAll ) return true;

        if ( this.#matchPaths.has( path ) ) return true;

        if ( this.#matchPatterns.size ) {
            this.#matchPatternsRegExp ??= this.#createRegExp();

            if ( this.#matchPatternsRegExp.test( path ) ) return true;
        }

        return false;
    }

    // private
    #normalizePattern ( pattern, prefix, relativeGlobstar ) {
        relativeGlobstar ??= this.#relativeGlobstar;

        if ( !pattern.startsWith( "/" ) && relativeGlobstar && !pattern.startsWith( "**/" ) ) {
            pattern = "**/" + pattern;
        }

        pattern = path.posix.join( "/", prefix || "", pattern, "." ).replaceAll( /\/\*\*(?:\/\*\*)+/g, "/**" );

        return pattern;
    }

    #compilePattern ( pattern ) {
        const compiledPattern = quoteMeta( pattern )

            // /**/
            .replaceAll( "/\\*\\*/", `(?:/|/${globstarSegment}/)` )

            // /**
            .replaceAll( "/\\*\\*", `(?:/|/${globstarSegment})` )

            // /*/
            .replaceAll( "/\\*/", `/${pathSegment}/` )

            // /*
            .replace( /\/\\\*/, `/${pathSegment}` )

            // path*, *path
            .replaceAll( "\\*", `${pathSegment}?` )

            // ?
            .replaceAll( "\\?", `${pathChar}` );

        return compiledPattern;
    }

    #createRegExp () {
        const parts = [];

        for ( const pattern of this.#matchPatterns.values() ) {
            parts.push( "(?:" + pattern + ")" );
        }

        return new RegExp( "^(?:" + parts.join( "|" ) + ")$", this.#caseSensitive ? "" : "i" );
    }
}

export default class GlobPatterns {
    #ignore;
    #caseSensitive;
    #relativeGlobstar;
    #allowed;
    #ignored;

    constructor ( { ignore, relativeGlobstar, caseSensitive = true } = {} ) {
        this.#ignore = !!ignore;
        this.#relativeGlobstar = !!relativeGlobstar;
        this.#caseSensitive = !!caseSensitive;

        this.#allowed = new GlobPatternsList( this.#relativeGlobstar, this.#caseSensitive );
        this.#ignored = new GlobPatternsList( this.#relativeGlobstar, this.#caseSensitive );
    }

    // static
    static isGlobPattern ( pattern ) {
        return isGlobPattern( pattern );
    }

    // properties
    get relativeGlobstar () {
        return this.#relativeGlobstar;
    }

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
        return isGlobPattern( pattern );
    }

    has ( pattern, { prefix, relativeGlobstar } = {} ) {
        if ( !pattern ) return false;

        var list;

        [pattern, list] = this.#preparePatern( pattern );

        return list.has( pattern, prefix, relativeGlobstar );
    }

    add ( patterns, { prefix, relativeGlobstar } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [pattern, list] = this.#preparePatern( pattern );

            list.add( pattern, prefix, relativeGlobstar );
        }

        return this;
    }

    delete ( patterns, { prefix, relativeGlobstar } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [pattern, list] = this.#preparePatern( pattern );

            list.delete( pattern, prefix, relativeGlobstar );
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

        if ( !this.#ignore ) {
            if ( this.#allowed.match( string ) && !this.#ignored.match( string ) ) return true;
        }
        else {
            if ( this.#ignored.match( string ) && !this.#allowed.match( string ) ) return true;
        }

        return false;
    }

    // private
    #preparePatern ( pattern ) {
        let list;

        if ( pattern.startsWith( DEFAULT_IGNORE_PREFIX ) ) {
            pattern = pattern.substring( DEFAULT_IGNORE_PREFIX.length );

            list = this.#ignore ? this.#allowed : this.#ignored;
        }
        else {
            list = this.#ignore ? this.#ignored : this.#allowed;
        }

        return [pattern, list];
    }
}
