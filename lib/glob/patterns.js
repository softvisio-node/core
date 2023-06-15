import { quoteMeta } from "#lib/utils";
import path from "node:path";

const pathChar = `[^/]`,
    pathSegment = `(?:${pathChar}+)`,
    globstarSegment = `(?:${pathSegment}(?:/${pathSegment})*)`;

class GlobPatternsList {
    #matchPaths = new Set();
    #matchPatterns = new Map();
    #matchPatternsRegExp;
    #matchAll = false;

    // properties
    hasPattens () {
        return this.#matchPaths.size && this.#matchPatterns.size;
    }

    // public
    add ( patterns, root ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#normalizePattern( pattern, root );

            if ( !this.#isGlobPattern( pattern ) ) {
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

            if ( !this.#isGlobPattern( pattern ) ) {
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
    #isGlobPattern ( pattern ) {
        return hasGlobRe.test( pattern );
    }

    #normalizePattern ( pattern, root ) {
        if ( !pattern.startsWith( "/" ) ) pattern = "**/" + pattern;

        pattern = path.posix.join( "/", root || "/", pattern, "." ).replaceAll( /\/\*\*(?:\/\*\*)+/g, "/**" );

        return pattern;
    }

    #compilePattern ( pattern ) {
        pattern = quoteMeta( pattern );

        pattern = pattern

            // **
            .replaceAll( "\\*\\*/", `${globstarSegment}*` )

            // /*/
            .replaceAll( "/\\*/", `/${pathSegment}/` )

            // path*, *path
            .replaceAll( "\\*", `${pathSegment}?` )

            // ?
            .replaceAll( "\\?", `${pathChar}` );

        return pattern;
    }

    #createRegExp () {
        const parts = [];

        for ( const pattern of this.#matchPatterns.values() ) {
            parts.push( "(?:" + pattern + ")" );
        }

        return new RegExp( "^(?:" + parts.join( "|" ) + ")$" );
    }
}

const hasGlobRe = /[*?]/g;

export default class GlobPatterns {
    #allowed = new GlobPatternsList();
    #ignored = new GlobPatternsList();

    // public
    add ( patterns, { root } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( const pattern of patterns ) {
            if ( pattern.startsWith( "!" ) ) {
                this.#ignored.add( pattern.substring( 1 ), root );
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
            if ( pattern.startsWith( "!" ) ) {
                this.#ignored.delette( pattern.substring( 1 ), root );
            }
            else {
                this.#allowed.delette( pattern, root );
            }
        }

        return this;
    }

    match ( string, { root } = {} ) {
        if ( !string ) return false;

        string = path.posix.join( "/", root || "/", string, "." );

        // path is not allowed
        if ( !this.#allowed.match( string ) ) return false;

        // path is allowed but ignored
        if ( this.#ignored.match( string ) ) return false;

        return true;
    }

    matchIgnored ( string, { root } = {} ) {
        if ( !string ) return false;

        string = path.posix.join( "/", root || "/", string, "." );

        // path is not ignoted
        if ( !this.#ignored.match( string ) ) return true;

        // path is allowed
        if ( this.#ignored.match( string ) ) return true;

        return false;
    }
}
