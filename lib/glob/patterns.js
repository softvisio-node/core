import GlobPattern from "./pattern.js";
import GlobPatternsList from "./patterns-list.js";

export default class GlobPatterns {
    #caseSensitive;
    #allowNegated;
    #allowBraces;
    #allowExtglob;
    #allowedList;
    #ignoredList;

    constructor ( { caseSensitive = true, allowNegated = true, allowBraces = true, allowExtglob = true } = {} ) {
        this.#caseSensitive = Boolean( caseSensitive );
        this.#allowNegated = Boolean( allowNegated );
        this.#allowBraces = Boolean( allowBraces );
        this.#allowExtglob = Boolean( allowExtglob );

        this.#allowedList = new GlobPatternsList( {
            "caseSensitive": this.#caseSensitive,
            "allowNegated": true,
            "allowBraces": this.#allowBraces,
            "allowExtglob": this.#allowExtglob,
        } );

        this.#ignoredList = new GlobPatternsList( {
            "caseSensitive": this.#caseSensitive,
            "allowNegated": true,
            "allowBraces": this.#allowBraces,
            "allowExtglob": this.#allowExtglob,
        } );
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
        return this.#allowedList.hasPatterns || this.#ignoredList.hasPatterns;
    }

    get allowedList () {
        return this.#allowedList;
    }

    get ignoredList () {
        return this.#ignoredList;
    }

    // public
    has ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } = {} ) {
        if ( !pattern ) return false;

        var list;

        [ pattern, list ] = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } );

        return list.has( pattern, { prefix } );
    }

    add ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [ pattern, list ] = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } );

            list.add( pattern, { prefix } );
        }

        return this;
    }

    delete ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [ pattern, list ] = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } );

            list.delete( pattern, { prefix } );
        }

        return this;
    }

    clear () {
        this.#allowedList.clear();
        this.#ignoredList.clear();

        return this;
    }

    test ( string, { prefix, normalize } = {} ) {
        if ( !string ) {
            return false;
        }
        else {
            string = GlobPattern.normalizePath( string, { prefix, normalize } );

            return this.#allowedList.test( string ) && !this.#ignoredList.test( string );
        }
    }

    toJSON () {
        return [

            //
            ...this.#allowedList.toJSON(),
            ...this.#ignoredList.toJSON(),
        ];
    }

    // private
    #createPattern ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowExtglob } ) {
        pattern = GlobPattern.new( pattern, {
            prefix,
            "caseSensitive": caseSensitive ?? this.#caseSensitive,
            "allowNegated": allowNegated ?? this.#allowNegated,
            "allowBraces": allowBraces ?? this.#allowBraces,
            "allowExtglob": allowExtglob ?? this.#allowExtglob,
        } );

        if ( pattern.isNegated ) {
            return [ pattern, this.#ignoredList ];
        }
        else {
            return [ pattern, this.#allowedList ];
        }
    }
}
