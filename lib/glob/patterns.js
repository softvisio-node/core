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
    #staticPatterns = new Set();
    #hasGlobPatterns = false;
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

            if ( spec.matchAll ) {
                this.#matchAll = true;
            }
            else if ( spec.globPattern ) {
                this.#hasGlobPatterns = true;
                this.#globRegExp = null;
            }
            else {
                this.#staticPatterns.add( pattern );
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

            if ( spec.matchAll ) {
                this.#matchAll = false;
            }
            else if ( spec.globPattern ) {
                this.#globRegExp = null;
            }
            else {
                this.#staticPatterns.delete( pattern );
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
    #normalizePattern ( pattern, prefix, relativeGlobstar ) {
        relativeGlobstar ??= this.#relativeGlobstar;

        if ( !pattern.startsWith( "/" ) && relativeGlobstar && !pattern.startsWith( "**/" ) ) {
            pattern = "**/" + pattern;
        }

        if ( pattern.startsWith( "/" ) ) {
            pattern = path.posix.normalize( pattern, "." );
        }
        else {
            pattern = path.posix.join( "/", prefix || "", pattern, "." );
        }

        return pattern.replaceAll( /\/\*\*(?:\/\*\*)+/g, "/**" );
    }

    #compilePattern ( pattern ) {
        const spec = {
            "depth": 0,
            "globPattern": null,
            "matchAll": false,
        };

        if ( pattern === "/**" ) {
            spec.matchAll = true;

            spec.depth = Infinity;
        }
        else if ( isGlobPattern( pattern ) ) {
            spec.globPattern = quoteMeta( pattern )

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
            spec.depth = pattern.split( "/" ).length - 1;
        }

        return spec;
    }

    #createRegExp () {
        const parts = [];

        for ( const pattern of this.#patterns.values() ) {
            if ( !pattern.globPattern ) continue;

            if ( pattern.matchAll ) continue;

            parts.push( "(?:" + pattern.globPattern + ")" );
        }

        if ( parts.length ) {
            return new RegExp( "^(?:" + parts.join( "|" ) + ")$", this.#caseSensitive ? "" : "i" );
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

        [pattern, list] = this.#preparePattern( pattern );

        return list.has( pattern, prefix, relativeGlobstar );
    }

    add ( patterns, { prefix, relativeGlobstar } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [pattern, list] = this.#preparePattern( pattern );

            list.add( pattern, prefix, relativeGlobstar );
        }

        return this;
    }

    delete ( patterns, { prefix, relativeGlobstar } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [pattern, list] = this.#preparePattern( pattern );

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

        if ( string.startsWith( "/" ) ) {
            string = path.posix.join( string, "." );
        }
        else {
            string = path.posix.join( "/", prefix || "", string, "." );
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
    #preparePattern ( pattern ) {
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
