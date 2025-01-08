import GlobPattern from "./pattern.js";
import GlobPatternsList from "./patterns-list.js";

export default class GlobPatterns {
    #caseSensitive;
    #allowNegated;
    #allowGlobstar;
    #allowBraces;
    #allowExtglob;
    #matchBasename;
    #allowedList;
    #ignoredList;

    constructor ( { caseSensitive = true, allowNegated = true, allowGlobstar = true, allowBraces = true, allowExtglob = true, matchBasename } = {} ) {
        this.#caseSensitive = Boolean( caseSensitive );
        this.#allowNegated = Boolean( allowNegated );
        this.#allowGlobstar = Boolean( allowGlobstar );
        this.#allowBraces = Boolean( allowBraces );
        this.#allowExtglob = Boolean( allowExtglob );
        this.#matchBasename = Boolean( matchBasename );

        this.#allowedList = new GlobPatternsList( {
            "caseSensitive": this.#caseSensitive,
            "allowNegated": true,
            "allowGlobstar": this.#allowGlobstar,
            "allowBraces": this.#allowBraces,
            "allowExtglob": this.#allowExtglob,
        } );

        this.#ignoredList = new GlobPatternsList( {
            "caseSensitive": this.#caseSensitive,
            "allowNegated": true,
            "allowGlobstar": this.#allowGlobstar,
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

    get allowGlobstar () {
        return this.#allowGlobstar;
    }

    get allowBraces () {
        return this.#allowBraces;
    }

    get allowExtglob () {
        return this.#allowExtglob;
    }

    get matchBasename () {
        return this.#matchBasename;
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
    has ( pattern, { prefix, caseSensitive, allowNegated, allowGlobstar, allowBraces, allowExtglob, matchBasename } = {} ) {
        if ( !pattern ) return false;

        var list;

        [ pattern, list ] = this.#createPattern( pattern, {
            prefix,
            caseSensitive,
            allowNegated,
            allowGlobstar,
            allowBraces,
            allowExtglob,
            matchBasename,
        } );

        return list.has( pattern, { prefix } );
    }

    add ( patterns, { prefix, caseSensitive, allowNegated, allowGlobstar, allowBraces, allowExtglob, matchBasename } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [ pattern, list ] = this.#createPattern( pattern, {
                prefix,
                caseSensitive,
                allowNegated,
                allowGlobstar,
                allowBraces,
                allowExtglob,
                matchBasename,
            } );

            list.add( pattern, { prefix } );
        }

        return this;
    }

    delete ( patterns, { prefix, caseSensitive, allowNegated, allowGlobstar, allowBraces, allowExtglob, matchBasename } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [ pattern, list ] = this.#createPattern( pattern, {
                prefix,
                caseSensitive,
                allowNegated,
                allowGlobstar,
                allowBraces,
                allowExtglob,
                matchBasename,
            } );

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
    #createPattern ( pattern, { prefix, caseSensitive, allowNegated, allowGlobstar, allowBraces, allowExtglob, matchBasename } ) {
        pattern = GlobPattern.new( pattern, {
            prefix,
            "caseSensitive": caseSensitive ?? this.#caseSensitive,
            "allowNegated": allowNegated ?? this.#allowNegated,
            "allowGlobstar": allowGlobstar ?? this.#allowGlobstar,
            "allowBraces": allowBraces ?? this.#allowBraces,
            "allowExtglob": allowExtglob ?? this.#allowExtglob,
            "matchBasename": matchBasename ?? this.#matchBasename,
        } );

        if ( pattern.isNegated ) {
            return [ pattern, this.#ignoredList ];
        }
        else {
            return [ pattern, this.#allowedList ];
        }
    }
}
