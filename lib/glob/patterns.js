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

    match ( path ) {
        if ( this.#matchAll ) return true;

        if ( this.#matchPaths.has( path ) ) return true;

        if ( this.#matchPatterns.size ) {
            this.#matchPatternsRegExp ??= this.#createRegExp();

            if ( this.#matchPatternsRegExp.test( path ) ) return true;
        }

        return false;
    }

    clear () {
        this.#matchPaths.clear();
        this.#matchPatterns.clear();
        this.#matchPatternsRegExp = null;
        this.#matchAll = false;
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

    // XXX
    #compilePattern ( pattern ) {
        pattern = quoteMeta( pattern );

        pattern = pattern

            // /**/
            .replaceAll( "/\\*\\*/", `(?:/|/${globstarSegment}+/)` )

            // **
            .replaceAll( "\\*\\*", `${globstarSegment}*` )

            // /*/
            .replaceAll( "/\\*/", `/${pathSegment}/` )

            // aaa*, aaa*
            .replaceAll( "\\*", `${pathSegment}*` )

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
    #match = new GlobPatternsList();
    #allowed = new GlobPatternsList();
    #ignored = new GlobPatternsList();

    // public
    addPatterns ( patterns, { root } = {} ) {
        this.#match.add( patterns, root );

        return this;
    }

    ignorePatterns ( patterns, { root } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( const pattern of patterns ) {
            if ( pattern.startsWith( "!" ) ) {
                this.#allowed.add( pattern.substring( 1 ), root );
            }
            else {
                this.#ignored.add( pattern, root );
            }
        }

        return this;
    }

    deletePatterns ( patterns, { root } = {} ) {
        this.#match.delete( patterns, root );

        return this;
    }

    deleteIgnorePatterns ( patterns, { root } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( const pattern of patterns ) {
            if ( pattern.startsWith( "!" ) ) {
                this.#allowed.delette( pattern.substring( 1 ), root );
            }
            else {
                this.#ignored.delette( pattern, root );
            }
        }

        return this;
    }

    // XXX
    match ( string, { root } = {} ) {
        if ( !string ) return false;

        string = path.posix.join( "/", root || "/", string, "." );

        if ( this.#match.hasPatterns && !this.#match.match( string ) ) return false;

        if ( this.#ignored.hasPatterns ) {
            if ( this.#ignored.match( string ) ) {

                //
            }
        }

        return false;
    }
}
