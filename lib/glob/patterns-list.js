import GlobPattern from "./pattern.js";

export default class GlobPatternsLise {
    #caseSensitive;
    #allowNegated;
    #allowBraces;
    #allowExtglob;
    #patterns = new Map();
    #isMatchAll = false;
    #regExp;

    constructor ( { caseSensitive = true, allowNegated = true, allowBraces = true, allowExtglob = true } = {} ) {
        this.#caseSensitive = Boolean( caseSensitive );
        this.#allowNegated = Boolean( allowNegated );
        this.#allowBraces = Boolean( allowBraces );
        this.#allowExtglob = Boolean( allowExtglob );
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

    get allowExtglob () {
        return this.#allowExtglob;
    }

    get hasPatterns () {
        return Boolean( this.#patterns.size );
    }

    get isMatchAll () {
        return this.#isMatchAll;
    }

    // XXX case sensitive
    get regExp () {
        if ( this.#regExp == null ) {
            if ( this.hasPatterns ) {
                if ( this.isMatchAll ) {
                    this.#regExp = new RegExp( ".+", this.#caseSensitive
                        ? ""
                        : "i" );
                }
                else {
                    this.#regExp = new RegExp( "(?:" + [ ...this.#patterns.values() ].map( pattern => pattern.regExp.source ).join( "|" ) + ")", this.#caseSensitive
                        ? ""
                        : "i" );
                }
            }
            else {
                this.#regExp = new RegExp( "^$", this.#caseSensitive
                    ? ""
                    : "i" );
            }
        }

        return this.#regExp;
    }

    // public
    has ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } = {} ) {
        if ( !pattern ) return false;

        pattern = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } );

        return this.#patterns.has( pattern.id );
    }

    add ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } );

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

    delete ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } );

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
            return false;
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
    #createPattern ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } ) {
        return GlobPattern.new( pattern, {
            prefix,
            "caseSensitive": caseSensitive ?? this.#caseSensitive,
            "allowNegated": allowNegated ?? this.#allowNegated,
            "allowBraces": allowBraces ?? this.#allowBraces,
            "allowExtglob": allowExtglob ?? this.#allowExtglob,
        } );
    }
}
