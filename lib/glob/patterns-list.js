import GlobPattern from "./pattern.js";

export default class GlobPatternsLise {
    #isCaseSensitive;
    #allowNegated;
    #allowBraces;
    #allowBrackets;
    #allowExtglob;
    #isMatchAll = false;
    #regExpPattern;
    #patterns = new Map();

    constructor ( { caseSensitive = true, allowNegated = true, allowBraces = true, allowBrackets = true, allowExtglob = true } = {} ) {
        this.#isCaseSensitive = Boolean( caseSensitive );
        this.#allowNegated = Boolean( allowNegated );
        this.#allowBraces = Boolean( allowBraces );
        this.#allowBrackets = Boolean( allowBrackets );
        this.#allowExtglob = Boolean( allowExtglob );
    }

    // properties
    get isCaseSensitive () {
        return this.#isCaseSensitive;
    }

    get allowNegated () {
        return this.#allowNegated;
    }

    get allowBraces () {
        return this.#allowBraces;
    }

    get allowBrackets () {
        return this.#allowBrackets;
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

    get regExpPattern () {
        if ( this.#regExpPattern == null ) {
            if ( this.hasPatterns ) {
                if ( this.isMatchAll ) {
                    this.#regExpPattern = ".+";
                }
                else {
                    this.#regExpPattern = "^(?:" + [ ...this.#patterns.values() ].map( pattern => pattern.regExpPattern ).join( "|" ) + ")$";
                }
            }
            else {
                this.#regExpPattern = "^$";
            }
        }

        return this.#regExpPattern;
    }

    // public
    has ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } = {} ) {
        if ( !pattern ) return false;

        pattern = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } );

        return this.#patterns.has( pattern.id );
    }

    add ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } );

            // add pattern
            if ( !this.#patterns.has( pattern.id ) ) {
                this.#patterns.set( pattern.id, pattern );

                if ( pattern.isMatchAll ) {
                    this.#isMatchAll = true;
                }

                this.#regExpPattern = null;
            }
        }

        return this;
    }

    delete ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } );

            pattern = this.#patterns.get( pattern.id );

            // pattern exists
            if ( pattern ) {
                this.#patterns.delete( pattern.id );

                // delete "match-all" pattern or patterns list is empty
                if ( pattern.isMatchAll || !this.#patterns.size ) {
                    this.#isMatchAll = false;
                }

                this.#regExpPattern = null;
            }
        }

        return this;
    }

    clear () {
        this.#patterns.clear();
        this.#isMatchAll = false;
        this.#regExpPattern = null;

        return this;
    }

    test ( path ) {
        if ( !path ) {
            return false;
        }
        else if ( !this.hasPatterns ) {
            return false;
        }
        else if ( this.#isMatchAll ) {
            return true;
        }
        else {
            for ( const pattern of this.#patterns.values() ) {
                if ( pattern.test( path ) ) return true;
            }
        }

        return false;
    }

    toJSON () {
        return [ ...this.#patterns.keys() ];
    }

    // private
    #createPattern ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } ) {
        return GlobPattern.new( pattern, {
            prefix,
            "caseSensitive": caseSensitive ?? this.#isCaseSensitive,
            "allowNegated": allowNegated ?? this.#allowNegated,
            "allowBraces": allowBraces ?? this.#allowBraces,
            "allowBrackets": allowBrackets ?? this.#allowBrackets,
            "allowExtglob": allowExtglob ?? this.#allowExtglob,
        } );
    }
}
