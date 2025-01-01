import GlobPattern from "./pattern.js";

export default class GlobPatternsLise {
    #isCaseSensitive;
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
        }

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

            this.#patterns.delete( pattern.pattern );
        }

        return this;
    }

    clear () {
        this.#patterns.clear();

        return this;
    }

    test ( path ) {
        if ( !this.hasPatterns ) return false;

        for ( const pattern of this.#patterns.values() ) {
            if ( pattern.test( path ) ) return true;
        }

        return false;
    }

    toJSON () {
        return [ ...this.#patterns.keys() ];
    }
}
