import path from "node:path";
import GlobPattern from "./pattern.js";
import GlobPatternsList from "./patterns-list.js";

export default class GlobPatterns {
    #isCaseSensitive;
    #allowNegated;
    #allowBraces;
    #allowBrackets;
    #allowExtglob;
    #allowed;
    #ignored;

    constructor ( { caseSensitive = true, allowNegated = true, allowBraces = true, allowBrackets = true, allowExtglob = true } = {} ) {
        this.#isCaseSensitive = Boolean( caseSensitive );
        this.#allowNegated = Boolean( allowNegated );
        this.#allowBraces = Boolean( allowBraces );
        this.#allowBrackets = Boolean( allowBrackets );
        this.#allowExtglob = Boolean( allowExtglob );

        this.#allowed = new GlobPatternsList( { "caseSensitive": this.#isCaseSensitive } );
        this.#ignored = new GlobPatternsList( { "caseSensitive": this.#isCaseSensitive } );
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
        return this.#allowed.hasPatterns || this.#ignored.hasPatterns;
    }

    get allowedList () {
        return this.#allowed;
    }

    get ignoredList () {
        return this.#ignored;
    }

    // public
    has ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } = {} ) {
        if ( !pattern ) return false;

        var list;

        [ pattern, list ] = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } );

        return list.has( pattern, { prefix } );
    }

    add ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [ pattern, list ] = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } );

            list.add( pattern, { prefix } );
        }

        return this;
    }

    delete ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [ pattern, list ] = this.#createPattern( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } );

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

        string = path.posix.join( prefix || "", string, "." );

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
    #createPattern ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowBrackets, allowExtglob } ) {
        pattern = GlobPattern.new( pattern, {
            prefix,
            "caseSensitive": caseSensitive ?? this.#isCaseSensitive,
            "allowNegated": allowNegated ?? this.#allowNegated,
            "allowBraces": allowBraces ?? this.#allowBraces,
            "allowBrackets": allowBrackets ?? this.#allowBrackets,
            "allowExtglob": allowExtglob ?? this.#allowExtglob,
        } );

        if ( pattern.isNegated ) {
            return [ pattern, this.#ignored ];
        }
        else {
            return [ pattern, this.#allowed ];
        }
    }
}
