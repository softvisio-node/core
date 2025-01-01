import path from "node:path";
import GlobPatternsList from "./list.js";
import GlobPattern from "./pattern.js";

export default class GlobPatterns {
    #isCaseSensitive;
    #allowed;
    #ignored;

    constructor ( { caseSensitive = true } = {} ) {
        this.#isCaseSensitive = Boolean( caseSensitive );

        this.#allowed = new GlobPatternsList( { "caseSensitive": this.#isCaseSensitive } );
        this.#ignored = new GlobPatternsList( { "caseSensitive": this.#isCaseSensitive } );
    }

    // properties
    get isCaseSensitive () {
        return this.#isCaseSensitive;
    }

    get hasPatterns () {
        return this.#allowed.hasPatterns || this.#ignored.hasPatterns;
    }

    get allowedList () {
        return this.#allowed;
    }

    get ignoredList () {
        return this.#ignored;
    }

    // public
    has ( pattern, { prefix } = {} ) {
        if ( !pattern ) return false;

        const list = this.#getList( pattern );

        return list.has( pattern, { prefix } );
    }

    add ( patterns, { prefix } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( const pattern of patterns ) {
            if ( !pattern ) continue;

            const list = this.#getList( pattern );

            list.add( pattern, { prefix } );
        }

        return this;
    }

    delete ( patterns, { prefix } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( const pattern of patterns ) {
            if ( !pattern ) continue;

            const list = this.#getList( pattern );

            list.delete( pattern, { prefix } );
        }

        return this;
    }

    clear () {
        this.#allowed.clear();
        this.#ignored.clear();

        return this;
    }

    test ( string, { prefix } = {} ) {
        if ( !string ) return false;

        string = path.posix.join( "/", prefix || "", string, "." );

        return this.#allowed.test( string ) && !this.#ignored.test( string );
    }

    toJSON () {
        return [

            //
            ...this.#allowed.toJSON(),
            ...this.#ignored.toJSON(),
        ];
    }

    // private
    #getList ( pattern ) {
        if ( GlobPattern.isNegated( pattern ) ) {
            return this.#ignored;
        }
        else {
            return this.#allowed;
        }
    }
}
