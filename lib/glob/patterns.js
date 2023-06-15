import { quoteMeta } from "#lib/utils";
import path from "node:path";

const pathChar = `[^/]`,
    pathSegment = `(?:${pathChar}+)`,
    globstarSegment = `(?:${pathSegment}(?:/${pathSegment})*)`;

const hasGlobRe = /[*?]/g;

export default class GlobPatterns {
    #matchPaths = new Set();
    #matchPatterns = new Map();
    #matchPatternsRegExp;

    #allowedPaths = new Set();
    #allowedPatterns = new Map();
    #allowedPatternsRegExp;

    #ignoredPaths = new Set();
    #ignoredPatterns = new Map();
    #ignoredPatternsRegExp;

    // public
    addPatterns ( patterns, { root } = {} ) {
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
            }
        }

        return this;
    }

    ignorePatterns ( patterns, { root } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( let pattern of patterns ) {
            if ( pattern.startsWith( "!" ) ) {
                var allow = true;

                pattern = pattern.substring( 1 );
            }

            if ( !pattern ) continue;

            pattern = this.#normalizePattern( pattern, root );

            if ( !this.#isGlobPattern( pattern ) ) {
                if ( allow ) {
                    this.#allowedPaths.add( pattern );
                }
                else {
                    this.#ignoredPaths.add( pattern );
                }
            }
            else if ( allow ) {
                if ( !this.#allowedPatterns.has( pattern ) ) {
                    this.#allowedPatterns.set( pattern, this.#compilePattern( pattern ) );

                    this.#allowedPatternsRegExp = null;
                }
            }
            else {
                if ( !this.#ignoredPatterns.has( pattern ) ) {
                    this.#ignoredPatterns.set( pattern, this.#compilePattern( pattern ) );

                    this.#ignoredPatternsRegExp = null;
                }
            }
        }

        return this;
    }

    deletePatterns ( patterns, { root } = {} ) {
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
            }
        }

        return this;
    }

    deleteIgnorePatterns ( patterns, { root } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( let pattern of patterns ) {
            if ( pattern.startsWith( "!" ) ) {
                var allow = true;

                pattern = pattern.substring( 1 );
            }

            if ( !pattern ) continue;

            pattern = this.#normalizePattern( pattern, root );

            if ( !this.#isGlobPattern( pattern ) ) {
                if ( allow ) {
                    this.#allowedPaths.delete( pattern );
                }
                else {
                    this.#ignoredPaths.delete( pattern );
                }
            }
            else if ( allow ) {
                if ( this.#allowedPatterns.has( pattern ) ) {
                    this.#allowedPatterns.delete( pattern );

                    this.#allowedPatternsRegExp = null;
                }
            }
            else {
                if ( this.#ignoredPatterns.has( pattern ) ) {
                    this.#ignoredPatterns.delete( pattern );

                    this.#ignoredPatternsRegExp = null;
                }
            }
        }

        return this;
    }

    // XXX
    match ( string, { root } = {} ) {
        if ( !string ) return false;

        string = path.posix.join( "/", root || "/", string, "." );

        MATCH: if ( this.#matchPaths.size || this.#matchPatterns.size ) {
            if ( this.#matchPatterns.has( "/**" ) ) break MATCH;

            if ( this.#matchPaths.has( string ) ) break MATCH;

            if ( this.#matchPatterns.size ) {
                this.#matchPatternsRegExp ??= this.#createRegExp( this.#matchPatterns );

                if ( this.#matchPatternsRegExp.test( string ) ) break MATCH;
            }

            return false;
        }

        if ( this.#ignoredPaths.size || this.#ignoredPatterns.size ) {

            //
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

    #createRegExp ( patterns ) {
        const parts = [];

        for ( const pattern of patterns.values() ) {
            parts.push( "(?:" + pattern + ")" );
        }

        return new RegExp( "^(?:" + parts.join( "|" ) + ")$" );
    }
}
