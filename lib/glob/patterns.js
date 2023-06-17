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

    #depth = 0;
    #patterns = new Map();
    #pathPatterns = new Set();
    #globRegExp;
    #matchAll = false;

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

        pattern = this.#patterns.has( pattern );
    }

    add ( patterns, prefix, relativeGlobstar ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#normalizePattern( pattern, prefix, relativeGlobstar );

            if ( this.#patterns.has( pattern ) ) continue;

            const spec = this.#compilePattern( pattern );

            this.#patterns.set( pattern, spec );

            if ( spec.depth > this.#depth ) this.#depth = spec.depth;

            if ( spec.regExp ) {
                this.#globRegExp = null;

                if ( spec.matchAll ) this.#matchAll = true;
            }
            else {
                this.#pathPatterns.add( pattern );
            }
        }

        return this;
    }

    delete ( patterns, prefix, relativeGlobstar ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#normalizePattern( pattern, prefix, relativeGlobstar );

            const spec = this.#patterns.get( pattern );

            if ( !spec ) continue;

            this.#patterns.delete( pattern );

            if ( spec.regExp ) {
                this.#globRegExp = null;

                if ( spec.matchAll ) this.#matchAll = false;
            }
            else {
                this.#pathPatterns.delete( pattern );
            }
        }

        this.#depth = 0;

        // re-calculate depth
        for ( const pattern of this.#patterns.values() ) {
            if ( pattern.depth > this.#depth ) this.#depth = pattern.depth;
        }

        return this;
    }

    clear () {
        this.#depth = 0;
        this.#patterns.clear();
        this.#pathPatterns.clear();
        this.#globRegExp = null;
        this.#matchAll = false;
    }

    match ( path ) {
        if ( this.#matchAll ) return true;

        if ( this.#pathPatterns.has( path ) ) return true;

        this.#globRegExp ??= this.#globRegExp = this.#createRegExp();

        if ( this.#globRegExp && this.#globRegExp.test( path ) ) return true;

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
        const spec = {
            "depth": 0,
            "regExp": null,
            "matchAll": false,
        };

        if ( isGlobPattern( pattern ) ) {
            if ( pattern === "/**" ) spec.matchAll = true;

            spec.regExp = quoteMeta( pattern )

                // /**/
                .replaceAll( "/\\*\\*/", () => {
                    spec.depth = Infinity;

                    return `(?:/|/${globstarSegment}/)`;
                } )

                // /**
                .replaceAll( "/\\*\\*", () => {
                    spec.depth = Infinity;

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

        if ( !spec.depth ) {
            spec.depth = pattern.split( "/" ).length;
        }

        return spec;
    }

    #createRegExp () {
        const parts = [];

        for ( const pattern of this.#patterns.values() ) {
            if ( !pattern.regExp ) continue;

            parts.push( "(?:" + pattern.regExp + ")" );
        }

        if ( parts.length ) {
            return new RegExp( "^(?:" + parts.join( "|" ) + ")$", this.#caseSensitive ? "" : "i" );
        }
        else {
            return false;
        }
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
