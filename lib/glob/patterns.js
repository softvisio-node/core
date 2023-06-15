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
    #matchAll = true;

    // XXX
    #globstarPatterns = new Map();
    #regExp = false;

    #allowedPaths = new Set();
    #allowedPatterns = new Map();
    #allowedPatternsRegExp;
    #allowAll = false;

    #ignoredPaths = new Set();
    #ignoredPatterns = new Map();
    #ignoredPatternsRegExp;
    #ignoreAll = false;

    // properties
    get matchAll () {
        return this.#matchAll;
    }

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

        this.#matchAll = this.#matchPatterns.has( "/**" ) || ( !this.#matchPaths.size && !this.#matchPatterns.size );

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

                    if ( pattern === "/**" ) this.#allowAll = true;
                }
            }
            else {
                if ( !this.#ignoredPatterns.has( pattern ) ) {
                    this.#ignoredPatterns.set( pattern, this.#compilePattern( pattern ) );

                    this.#ignoredPatternsRegExp = null;

                    if ( pattern === "/**" ) this.#ignoreAll = true;
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

        this.#matchAll = this.#matchPatterns.has( "/**" ) || ( !this.#matchPaths.size && !this.#matchPatterns.size );

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

                    if ( pattern === "/**" ) this.#allowAll = false;
                }
            }
            else {
                if ( this.#ignoredPatterns.has( pattern ) ) {
                    this.#ignoredPatterns.delete( pattern );

                    this.#ignoredPatternsRegExp = null;

                    if ( pattern === "/**" ) this.#ignoreAll = false;
                }
            }
        }

        return this;
    }

    // XXX
    match ( string, { root } = {} ) {
        if ( !string ) return false;

        string = path.posix.join( "/", root || "/", string, "." );

        MATCH: if ( !this.#matchAll ) {
            if ( this.#matchPaths.has( string ) ) {
                break MATCH;
            }

            if ( this.#matchPatterns.size ) {
                this.#matchPatternsRegExp ??= this.#createRegExp( this.#matchPatterns );

                if ( this.#matchPatternsRegExp.test( string ) ) break MATCH;
            }

            if ( this.#matchPaths.size || this.#matchPatterns.size ) return false;
        }

        // XXX ==============================

        if ( this.#matchAll ) return true;

        if ( this.#matchPaths.has( path ) ) return true;

        if ( this.#regExp == null ) {
            if ( !this.hasGlobPatterns ) {
                this.#regExp = false;
            }
            else {
                const patterns = [];

                for ( const pattern of this.#matchPatterns.values() ) {
                    patterns.push( "(?:" + pattern + ")" );
                }

                for ( const pattern of this.#globstarPatterns.values() ) {
                    patterns.push( "(?:" + pattern + ")" );
                }

                this.#regExp = new RegExp( "^(?:" + patterns.join( "|" ) + ")$" );
            }
        }

        if ( this.#regExp ) return this.#regExp.test( path );

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

    // XXX
    #createRegExp ( patterns ) {}
}
