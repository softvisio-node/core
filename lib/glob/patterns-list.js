import GlobPattern from "./pattern.js";

export default class GlobPatternsLise {
    #isCaseSensitive;
    #isMatchAll = false;
    #regExpPattern;
    #patterns = new Map();

    constructor ( { caseSensitive } = {} ) {
        this.#isCaseSensitive = Boolean( caseSensitive );
    }

    // properties
    get isCaseSensitive () {
        return this.#isCaseSensitive;
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
    has ( pattern, { prefix } = {} ) {
        if ( !pattern ) return false;

        pattern = GlobPattern.new( pattern, {
            "caseSensitive": this.#isCaseSensitive,
            prefix,
        } );

        return this.#patterns.has( pattern.pattern );
    }

    add ( patterns, { prefix } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = GlobPattern.new( pattern, {
                "caseSensitive": this.#isCaseSensitive,
                prefix,
            } );

            this.#patterns.set( pattern.pattern, pattern );

            if ( pattern.isMatchAll ) {
                this.#isMatchAll = true;
            }
        }

        this.#regExpPattern = null;

        return this;
    }

    delete ( patterns, { prefix } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = GlobPattern.new( pattern, {
                "caseSensitive": this.#isCaseSensitive,
                prefix,
            } );

            pattern = this.#patterns.get( pattern.pattern );

            // pattern exists
            if ( pattern ) {
                this.#patterns.delete( pattern.pattern );

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
}
