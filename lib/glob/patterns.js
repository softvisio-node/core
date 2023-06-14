import { quoteMeta } from "#lib/utils";

const pathChar = `[^/]`,
    pathSegment = `(?:${pathChar}+)`,
    globstarSegment = `(?:${pathSegment}(?:/${pathSegment})*)`;

const hasGlobRe = /[*?]/g;

export default class GlobPatterns {
    #glob;
    #globstar;
    #namingConvention;
    #stringPatterns = new Set();
    #globPatterns = new Map();
    #globstarPatterns = new Map();
    #matchAll = false;
    #regExp = false;

    constructor ( { glob = true, globstar = true, namingConvention } = {} ) {
        this.#glob = !!glob;
        this.#globstar = !!globstar;
        this.#namingConvention = namingConvention;
    }

    // properties
    get glob () {
        return this.#glob;
    }

    get globstar () {
        return this.#globstar;
    }

    get namingConvention () {
        return this.#namingConvention;
    }

    get hasGlobPatterns () {
        return this.#globPatterns.size || this.#globstarPatterns.size;
    }

    get hasGlobstarPatterns () {
        return !!this.#globstarPatterns.size;
    }

    get matchAll () {
        return this.#matchAll;
    }

    // public
    hasGlob ( pattern ) {
        return hasGlobRe.test( pattern );
    }

    hasGlobstar ( pattern ) {
        return pattern.includes( "**" );
    }

    // XXX naming convention
    // XXX return result ???
    validate ( pattern, { glob, globstar, namingConvention } = {} ) {
        if ( glob === undefined ) glob = this.#glob;
        if ( globstar === undefined ) globstar = this.#globstar;
        if ( namingConvention === undefined ) namingConvention = this.#namingConvention;

        if ( this.hasGlob( pattern ) ) {
            if ( !glob ) return false;

            if ( !globstar && this.hasGlobstar( pattern ) ) return false;
        }

        if ( namingConvention ) {

            // XXX
        }

        return true;
    }

    add ( patterns ) {
        if ( !Array.isArray( patterns ) ) patterns = [patterns];

        for ( const pattern of patterns ) {

            // pattern already added
            if ( this.#stringPatterns.has( pattern ) ) return;
            if ( this.#globPatterns.has( pattern ) ) return;
            if ( this.#globstarPatterns.has( pattern ) ) return;

            if ( pattern === "**" ) this.#matchAll = true;

            // validate pattern
            const valid = this.validate( pattern );
            if ( !valid ) throw valid;

            if ( this.hasGlob( pattern ) ) {
                if ( this.hasGlobstar( pattern ) ) {
                    this.#globstarPatterns.set( pattern, this.#compilePattern( pattern ) );
                }
                else {
                    this.#globPatterns.set( pattern, this.#compilePattern( pattern ) );
                }

                this.#regExp = null;
            }
            else {
                this.#stringPatterns.add( pattern );
            }
        }

        return this;
    }

    delete ( pattern ) {
        if ( this.#stringPatterns.has( pattern ) ) {
            this.#stringPatterns.delete( pattern );
        }
        else if ( this.#globPatterns.has( pattern ) ) {
            this.#globPatterns.delete( pattern );

            this.#regExp = null;
        }
        else if ( this.#globstarPatterns.has( pattern ) ) {
            if ( pattern === "**" ) this.#matchAll = false;

            this.#globstarPatterns.delete( pattern );

            this.#regExp = null;
        }

        return this;
    }

    match ( path ) {
        if ( this.#matchAll ) return true;

        if ( this.#stringPatterns.has( path ) ) return true;

        if ( this.#regExp == null ) {
            if ( !this.hasGlobPatterns ) {
                this.#regExp = false;
            }
            else {
                const patterns = [];

                for ( const pattern of this.#globPatterns.values() ) {
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

    clear () {
        this.#stringPatterns.clear();
        this.#globPatterns.clear();
        this.#globstarPatterns.clear();

        this.#regExp = false;

        return this;
    }

    // private
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
}
