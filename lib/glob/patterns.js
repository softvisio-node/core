import GlobPattern from "./pattern.js";
import GlobPatternsList from "./patterns-list.js";

export default class GlobPatterns {
    #caseSensitive;
    #allowNegated;
    #allowBraces;
    #allowGlobstar;
    #allowExtglob;
    #matchBasename;
    #matchIfEmpty;
    #allowedList;
    #ignoredList;

    constructor ( { caseSensitive = true, allowNegated = true, allowBraces = true, allowGlobstar = true, allowExtglob = true, matchBasename, matchIfEmpty } = {} ) {
        this.#caseSensitive = Boolean( caseSensitive );
        this.#allowNegated = Boolean( allowNegated );
        this.#allowBraces = Boolean( allowBraces );
        this.#allowGlobstar = Boolean( allowGlobstar );
        this.#allowExtglob = Boolean( allowExtglob );
        this.#matchBasename = Boolean( matchBasename );
        this.#matchIfEmpty = Boolean( matchIfEmpty );

        this.#allowedList = new GlobPatternsList( {
            "caseSensitive": this.#caseSensitive,
            "allowNegated": true,
            "allowBraces": this.#allowBraces,
            "allowGlobstar": this.#allowGlobstar,
            "allowExtglob": this.#allowExtglob,
            "matchBasename": this.#matchBasename,
            "matchIfEmpty": this.#matchIfEmpty,
        } );

        this.#ignoredList = new GlobPatternsList( {
            "caseSensitive": this.#caseSensitive,
            "allowNegated": true,
            "allowBraces": this.#allowBraces,
            "allowGlobstar": this.#allowGlobstar,
            "allowExtglob": this.#allowExtglob,
            "matchBasename": this.#matchBasename,
            "matchIfEmpty": false,
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
        return this.#allowedList.hasPatterns || this.#ignoredList.hasPatterns;
    }

    get allowedList () {
        return this.#allowedList;
    }

    get ignoredList () {
        return this.#ignoredList;
    }

    // public
    has ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowGlobstar, allowExtglob, matchBasename } = {} ) {
        if ( !pattern ) return false;

        var list;

        [ pattern, list ] = this.#createPattern( pattern, {
            prefix,
            caseSensitive,
            allowNegated,
            allowBraces,
            allowGlobstar,
            allowExtglob,
            matchBasename,
        } );

        return list.has( pattern, { prefix } );
    }

    add ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowGlobstar, allowExtglob, matchBasename } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [ pattern, list ] = this.#createPattern( pattern, {
                prefix,
                caseSensitive,
                allowNegated,
                allowBraces,
                allowGlobstar,
                allowExtglob,
                matchBasename,
            } );

            list.add( pattern, { prefix } );
        }

        return this;
    }

    delete ( patterns, { prefix, caseSensitive, allowNegated, allowBraces, allowGlobstar, allowExtglob, matchBasename } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [ pattern, list ] = this.#createPattern( pattern, {
                prefix,
                caseSensitive,
                allowNegated,
                allowBraces,
                allowGlobstar,
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
    #createPattern ( pattern, { prefix, caseSensitive, allowNegated, allowBraces, allowGlobstar, allowExtglob, matchBasename } ) {
        pattern = GlobPattern.new( pattern, {
            prefix,
            "caseSensitive": caseSensitive ?? this.#caseSensitive,
            "allowNegated": allowNegated ?? this.#allowNegated,
            "allowBraces": allowBraces ?? this.#allowBraces,
            "allowGlobstar": allowGlobstar ?? this.#allowGlobstar,
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
