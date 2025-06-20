import GlobPattern from "./pattern.js";

export default class GlobPatternsLise {
    #caseSensitive;
    #allowNegated;
    #allowBraces;
    #allowGlobstar;
    #allowExtglob;
    #matchBasename;
    #matchIfEmpty;
    #patterns = new Map();
    #isMatchAll = false;
    #regExp;

    constructor ( { caseSensitive = true, allowNegated = true, allowBraces = true, allowGlobstar = true, allowExtglob = true, matchBasename, matchIfEmpty } = {} ) {
        this.#caseSensitive = Boolean( caseSensitive );
        this.#allowNegated = Boolean( allowNegated );
        this.#allowBraces = Boolean( allowBraces );
        this.#allowGlobstar = Boolean( allowGlobstar );
        this.#allowExtglob = Boolean( allowExtglob );
        this.#matchBasename = Boolean( matchBasename );
        this.#matchIfEmpty = Boolean( matchIfEmpty );
    }

    // properties
    get isCaseSensitive () {
        return this.#caseSensitive;
    }

    get allowNegated () {
        return this.#allowNegated;
    }

    get allowBraces () {
        return this.#allowBraces;
    }

    get allowGlobstar () {
        return this.#allowGlobstar;
    }

    get allowExtglob () {
        return this.#allowExtglob;
    }

    get matchBasename () {
        return this.#matchBasename;
    }

    get matchIfEmpty () {
        return this.#matchIfEmpty;
    }

    get hasPatterns () {
        return Boolean( this.#patterns.size );
    }

    get isMatchAll () {
        return this.#isMatchAll;
    }

    get regExp () {
        if ( this.#regExp == null ) {

            // has patterns
            if ( this.hasPatterns ) {
                if ( this.isMatchAll ) {

                    // match any not-empty string
                    this.#regExp = new RegExp( ".+" );
                }
                else {

                    // match pattern
                    this.#regExp = new RegExp( "(?:" + [ ...this.#patterns.values() ].map( pattern => pattern.regExp.source ).join( "|" ) + ")", this.#caseSensitive
                        ? ""
                        : "i" );
                }
            }

            // has no patterns
            else {

                // match any non-empty string
                if ( this.matchIfEmpty ) {
                    this.#regExp = new RegExp( ".+" );
                }

                // do not match any string
                else {
                    this.#regExp = new RegExp( "^\b$" );
                }
            }
        }

        return this.#regExp;
    }

    // public
    has ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowGlobstar, allowExtglob, matchBasename } = {} ) {
        if ( !pattern ) return false;

        pattern = this.#createPattern( pattern, {
            prefix,
            caseSensitive,
            allowNegated,
            allowBraces,
            allowGlobstar,
            allowExtglob,
            matchBasename,
        } );

        return this.#patterns.has( pattern.id );
    }

    add ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowGlobstar, allowExtglob, matchBasename } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, {
                prefix,
                caseSensitive,
                allowNegated,
                allowBraces,
                allowGlobstar,
                allowExtglob,
                matchBasename,
            } );

            // add pattern
            if ( !this.#patterns.has( pattern.id ) ) {
                this.#patterns.set( pattern.id, pattern );

                if ( pattern.isMatchAll ) {
                    this.#isMatchAll = true;
                }

                this.#regExp = null;
            }
        }

        return this;
    }

    delete ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowGlobstar, allowExtglob, matchBasename } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, {
                prefix,
                caseSensitive,
                allowNegated,
                allowBraces,
                allowGlobstar,
                allowExtglob,
                matchBasename,
            } );

            pattern = this.#patterns.get( pattern.id );

            // pattern exists
            if ( pattern ) {
                this.#patterns.delete( pattern.id );

                // delete "match-all" pattern or patterns list is empty
                if ( pattern.isMatchAll || !this.#patterns.size ) {
                    this.#isMatchAll = false;
                }

                this.#regExp = null;
            }
        }

        return this;
    }

    clear () {
        this.#patterns.clear();
        this.#isMatchAll = false;
        this.#regExp = null;

        return this;
    }

    test ( string, { prefix, normalize } = {} ) {
        if ( !string ) {
            return false;
        }
        else if ( !this.hasPatterns ) {
            if ( this.matchIfEmpty ) {
                return true;
            }
            else {
                return false;
            }
        }
        else if ( this.#isMatchAll ) {
            return true;
        }
        else {
            string = GlobPattern.normalizePath( string, { prefix, normalize } );

            for ( const pattern of this.#patterns.values() ) {
                if ( pattern.test( string, { "ignoreNegated": true } ) ) return true;
            }

            return false;
        }
    }

    toJSON () {
        return [ ...this.#patterns.values() ].map( pattern => pattern.pattern );
    }

    // private
    #createPattern ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowGlobstar, allowExtglob, matchBasename } ) {
        return GlobPattern.new( pattern, {
            prefix,
            "caseSensitive": caseSensitive ?? this.#caseSensitive,
            "allowNegated": allowNegated ?? this.#allowNegated,
            "allowBraces": allowBraces ?? this.#allowBraces,
            "allowGlobstar": allowGlobstar ?? this.#allowGlobstar,
            "allowExtglob": allowExtglob ?? this.#allowExtglob,
            "matchBasename": matchBasename ?? this.#matchBasename,
        } );
    }
}
