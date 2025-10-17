import path from "node:path";

const pathChar = "[^/]",
    globstarSegment = `.*${ pathChar }`;

const DEFAULT_IGNORE_PREFIX = "!";

const isGlobPatternRegExp = /[*?]/;

export class GlobPattern {
    #text;
    #caseSensitive;
    #isGlobPattern;
    #isIgnore;
    #depth;
    #matchAll;
    #pattern;
    #regExp;
    #unescapedPattern;
    #escapes = [];

    constructor ( pattern, { caseSensitive = true, prefix, relativeGlobstar } = {} ) {
        this.#caseSensitive = !!caseSensitive;

        // ignore pattern
        if ( pattern.startsWith( DEFAULT_IGNORE_PREFIX ) ) {
            this.#isIgnore = true;

            pattern = pattern.slice( DEFAULT_IGNORE_PREFIX.length );
        }
        else {
            this.#isIgnore = false;
        }

        // unescape
        pattern = pattern.replaceAll( /\\(.)/g, ( match, escape ) => {
            this.#escapes.push( escape );

            return "\0";
        } );

        // relativeGlobStar
        if ( !pattern.startsWith( "/" ) && relativeGlobstar && !pattern.startsWith( "**/" ) ) {
            pattern = "**/" + pattern;
        }

        // normalize
        this.#unescapedPattern = path.posix.join( "/", prefix || "", pattern, "." ).replaceAll( /\/\*\*(?:\/\*\*)+/g, "/**" );
    }

    // static
    static new ( pattern, { caseSensitive = true, prefix, relativeGlobstar } = {} ) {
        if ( pattern instanceof GlobPattern ) return pattern;

        return new this( pattern, { caseSensitive, prefix, relativeGlobstar } );
    }

    // properties
    get text () {
        if ( this.#text == null ) {

            // escape
            this.#text = this.#escape( this.#unescapedPattern );

            // add ignore prefix
            if ( this.#isIgnore ) this.#text = DEFAULT_IGNORE_PREFIX + this.#text;
        }

        return this.#text;
    }

    get isGlobPattern () {
        this.#isGlobPattern ??= isGlobPatternRegExp.test( this.#unescapedPattern );

        return this.#isGlobPattern;
    }

    get isCaseSensitive () {
        return this.#caseSensitive;
    }

    get isIgnore () {
        return this.#isIgnore;
    }

    get depth () {
        if ( !this.#regExp ) this.#compile();

        return this.#depth;
    }

    get isMatchAll () {
        if ( !this.#regExp ) this.#compile();

        return this.#matchAll;
    }

    get pattern () {
        if ( !this.#regExp ) this.#compile();

        return this.#pattern;
    }

    get regExp () {
        if ( !this.#regExp ) this.#compile();

        return this.#regExp;
    }

    // public
    toString () {
        return this.text;
    }

    toJSON () {
        return this.toString();
    }

    // private
    #compile () {

        // match all pattern
        if ( this.#unescapedPattern === "/**" ) {
            this.#matchAll = true;

            this.#depth = Infinity;

            this.#pattern = "";
        }

        // glob pattern
        else if ( this.isGlobPattern ) {
            this.#pattern = RegExp.escape( this.#unescapedPattern )

                // /**/
                .replaceAll( "/\\*\\*/", () => {
                    this.#depth = Infinity;

                    return `(?:/|/${ globstarSegment }/)`;
                } )

                // /**
                .replaceAll( "/\\*\\*", () => {
                    this.#depth = Infinity;

                    return `(?:/|/${ globstarSegment })`;
                } )

                // /*/
                .replaceAll( "/\\*/", `/${ pathChar }+/` )

                // /*
                .replace( /\/\\\*/, `/${ pathChar }+` )

                // path*, *path
                .replaceAll( "\\*", `${ pathChar }*` )

                // ?
                .replaceAll( "\\?", `${ pathChar }` );

            // escape
            this.#pattern = this.#escape( this.#pattern );

            this.#pattern = `^${ this.#pattern }$`;
        }

        // static pattern
        else {
            this.#pattern = this.#unescapedPattern;

            // escape
            this.#pattern = this.#escape( this.#pattern );

            this.#pattern = "^" + RegExp.escape( this.#pattern ) + "$";
        }

        this.#regExp = new RegExp( this.#pattern, this.#caseSensitive
            ? ""
            : "i" );

        if ( !this.#depth ) {
            this.#depth = this.#unescapedPattern.split( "/" ).length - 1;
        }
    }

    #escape ( value ) {
        if ( !this.#escapes.length ) return value;

        var id = 0;

        return value.replaceAll( "\0", () => "\\" + this.#escapes[ id++ ] );
    }
}

class GlobPatternsList {
    #caseSensitive;
    #patterns = new Map();
    #depth = 0;
    #matchAll = false;
    #pattern;
    #regExp;

    constructor ( { caseSensitive = true } = {} ) {
        this.#caseSensitive = !!caseSensitive;
    }

    // properties
    get isCaseSensitive () {
        return this.#caseSensitive;
    }

    get hasPatterns () {
        return !!this.#patterns.size;
    }

    get depth () {
        return this.#depth;
    }

    get isMatchAll () {
        return this.#matchAll;
    }

    get pattern () {
        if ( !this.#regExp ) this.#compile();

        return this.#pattern;
    }

    get regExp () {
        if ( !this.#regExp ) this.#compile();

        return this.#regExp;
    }

    // public
    has ( pattern, { prefix, relativeGlobstar } = {} ) {
        if ( !pattern ) return false;

        pattern = this.#createPattern( pattern, prefix, relativeGlobstar );

        return this.#patterns.has( pattern.text );
    }

    add ( patterns, prefix, relativeGlobstar ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, prefix, relativeGlobstar );

            // already added
            if ( this.#patterns.has( pattern.text ) ) continue;

            this.#patterns.set( pattern.text, pattern );

            if ( pattern.depth > this.#depth ) this.#depth = pattern.depth;

            if ( pattern.isMatchAll ) {
                this.#matchAll = true;
            }

            this.#pattern = null;
            this.#regExp = null;
        }

        return this;
    }

    delete ( patterns, { prefix, relativeGlobstar } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            pattern = this.#createPattern( pattern, prefix, relativeGlobstar );

            pattern = this.#patterns.get( pattern.text );

            // not exists
            if ( !pattern ) continue;

            this.#patterns.delete( pattern.text );

            if ( pattern.isMatchAll ) {
                this.#matchAll = false;
            }

            this.#pattern = null;
            this.#regExp = null;
        }

        this.#depth = 0;

        // re-calculate depth
        for ( const pattern of this.#patterns.values() ) {
            if ( pattern.depth > this.#depth ) this.#depth = pattern.depth;
        }

        return this;
    }

    clear () {
        this.#patterns.clear();
        this.#depth = 0;
        this.#matchAll = false;
        this.#pattern = null;
        this.#regExp = null;
    }

    test ( path ) {
        if ( !this.hasPatterns ) return false;

        if ( this.#matchAll ) return true;

        if ( !this.#regExp ) this.#compile();

        return this.#regExp.test( path );
    }

    toJSON () {
        return [ ...this.#patterns.keys() ];
    }

    // private
    #createPattern ( pattern, prefix, relativeGlobstar ) {
        return GlobPattern.new( pattern, {
            prefix,
            relativeGlobstar,
            "caseSensitive": this.#caseSensitive,
        } );
    }

    #compile () {

        // no patterns
        if ( !this.hasPatterns ) {
            this.#pattern = "^$";
        }

        // match all
        else if ( this.#matchAll ) {
            this.#pattern = "";
        }

        // patterns
        else {
            this.#pattern = [ ...this.#patterns.values() ]
                .sort( ( a, b ) => {
                    if ( a.isGlobPattern === b.isGlobPattern ) {
                        return a.pattern.localeCompare( b.pattern );
                    }
                    else if ( a.isGlobPattern ) {
                        return 1;
                    }
                    else {
                        return -1;
                    }
                } )
                .map( pattern => pattern.pattern )
                .join( "|" );
        }

        this.#regExp = new RegExp( this.#pattern, this.#caseSensitive
            ? ""
            : "i" );
    }
}

export default class GlobPatterns {
    #caseSensitive;
    #allowed;
    #ignored;

    constructor ( { caseSensitive = true } = {} ) {
        this.#caseSensitive = !!caseSensitive;

        this.#allowed = new GlobPatternsList( { "caseSensitive": this.#caseSensitive } );
        this.#ignored = new GlobPatternsList( { "caseSensitive": this.#caseSensitive } );
    }

    // static
    static isGlobPattern ( pattern ) {
        return GlobPattern.new( pattern ).isGlobPattern;
    }

    // properties
    get hasPatterns () {
        return this.#allowed.hasPatterns || this.#ignored.hasPatterns;
    }

    get depth () {
        return this.#allowed.depth;
    }

    get allowedList () {
        return this.#allowed;
    }

    get ignoredList () {
        return this.#ignored;
    }

    // public
    isGlobPattern ( pattern ) {
        return GlobPattern.new( pattern ).isGlobPattern;
    }

    has ( pattern, { prefix, relativeGlobstar } = {} ) {
        if ( !pattern ) return false;

        var list;

        [ pattern, list ] = this.#createPattern( pattern, prefix, relativeGlobstar );

        return list.has( pattern, { prefix, relativeGlobstar } );
    }

    add ( patterns, { prefix, relativeGlobstar } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [ pattern, list ] = this.#createPattern( pattern, prefix, relativeGlobstar );

            list.add( pattern, { prefix, relativeGlobstar } );
        }

        return this;
    }

    delete ( patterns, { prefix, relativeGlobstar } = {} ) {
        if ( !Array.isArray( patterns ) ) patterns = [ patterns ];

        var list;

        for ( let pattern of patterns ) {
            if ( !pattern ) continue;

            [ pattern, list ] = this.#createPattern( pattern, prefix, relativeGlobstar );

            list.delete( pattern, { prefix, relativeGlobstar } );
        }

        return this;
    }

    clear () {
        this.#allowed.clear();
        this.#ignored.clear();
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
            ...this.#ignored.toJSON().map( pattern => "!" + pattern ),
        ];
    }

    // private
    #createPattern ( pattern, prefix, relativeGlobstar ) {
        pattern = GlobPattern.new( pattern, {
            "caseSensitive": this.#caseSensitive,
            prefix,
            relativeGlobstar,
        } );

        let list;

        if ( pattern.isIgnore ) {
            list = this.#ignored;
        }
        else {
            list = this.#allowed;
        }

        return [ pattern, list ];
    }
}
