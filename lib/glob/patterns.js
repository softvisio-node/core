import { quoteMeta } from "#lib/utils";
import path from "node:path";

const pathChar = `[^/]`,
    pathSegment = `(?:${pathChar}+)`,
    globstarSegment = `(?:${pathSegment}(?:/${pathSegment})*)`;

const DEFAULT_IGNORE_PREFIX = "!";

const isGlobPatternRegExp = /[*?]/;

function isGlobPattern ( pattern ) {
    return isGlobPatternRegExp.test( pattern );
}

class GlobPatternsList {
    #relativeGlobstar;
    #matchPaths = new Set();
    #matchPatterns = new Map();
    #matchPatternsRegExp;
    #matchAll = false;

    constructor ( relativeGlobstar ) {
        this.#relativeGlobstar = !!relativeGlobstar;
    }

    // public
    has ( pattern, root ) {
        pattern = this.#normalizePattern( pattern, root );

        if ( !isGlobPattern( pattern ) ) {
            return this.#matchPaths.has( pattern );
        }
        else {
            return this.#matchPatterns.has( pattern );
        }
    }

    add ( patterns, root ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#normalizePattern( pattern, root );

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

    delete ( patterns, root ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#normalizePattern( pattern, root );

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
    #normalizePattern ( pattern, root ) {
        if ( !pattern.startsWith( "/" ) ) {
            if ( this.#relativeGlobstar ) {
                pattern = "**/" + pattern;
            }
        }

        pattern = path.posix.join( "/", root || "", pattern, "." ).replaceAll( /\/\*\*(?:\/\*\*)+/g, "/**" );

        return pattern;
    }

    #compilePattern ( pattern ) {
        const compiledPattern = quoteMeta( pattern )

            // /**/
            .replaceAll( "/\\*\\*/", `(?:/|/${globstarSegment}+/)` )

            // /**
            .replaceAll( "/\\*\\*", `/${globstarSegment}*` )

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

        return new RegExp( "^(?:" + parts.join( "|" ) + ")$" );
    }
}

export default class GlobPatterns {
    #relativeGlobstar;
    #allowed;
    #ignored;

    constructor ( { relativeGlobstar } = {} ) {
        this.#relativeGlobstar = !!relativeGlobstar;

        this.#allowed = new GlobPatternsList( this.#relativeGlobstar );
        this.#ignored = new GlobPatternsList( this.#relativeGlobstar );
    }

    // static
    static isGlobPattern ( pattern ) {
        return isGlobPattern( pattern );
    }

    // properties
    get relativeGlobstar () {
        return this.#relativeGlobstar;
    }

    // public
    isGlobPattern ( pattern ) {
        return isGlobPattern( pattern );
    }

    has ( pattern, { root } = {} ) {
        if ( pattern.startsWith( DEFAULT_IGNORE_PREFIX ) ) {
            return this.#ignored.has( pattern.substring( DEFAULT_IGNORE_PREFIX.length ), root );
        }
        else {
            return this.#allowed.has( pattern, root );
        }
    }

    add ( patterns, { root } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( const pattern of patterns ) {
            if ( !pattern ) continue;

            if ( pattern.startsWith( DEFAULT_IGNORE_PREFIX ) ) {
                this.#ignored.add( pattern.substring( DEFAULT_IGNORE_PREFIX.length ), root );
            }
            else {
                this.#allowed.add( pattern, root );
            }
        }

        return this;
    }

    delete ( patterns, { root } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( const pattern of patterns ) {
            if ( !pattern ) continue;

            if ( pattern.startsWith( DEFAULT_IGNORE_PREFIX ) ) {
                this.#ignored.delette( pattern.substring( DEFAULT_IGNORE_PREFIX.length ), root );
            }
            else {
                this.#allowed.delette( pattern, root );
            }
        }

        return this;
    }

    clear () {
        this.#allowed.clear();
        this.#ignored.clear();
    }

    match ( string, { root } = {} ) {
        if ( !string ) return false;

        string = path.posix.join( "/", root || "", string, "." );

        // path is not allowed
        if ( !this.#allowed.match( string ) ) return false;

        // path is allowed but ignored
        if ( this.#ignored.match( string ) ) return false;

        return true;
    }

    matchIgnored ( string, { root } = {} ) {
        if ( !string ) return false;

        string = path.posix.join( "/", root || "", string, "." );

        // path is not ignoted
        if ( !this.#allowed.match( string ) ) return false;

        // path is allowed
        if ( this.#ignored.match( string ) ) return false;

        return true;
    }
}
