// NOTE https://en.wikipedia.org/wiki/Naming_convention_(programming)#Multiple-word_identifiers

export function isKebabCase ( string, { sep } = {} ) {
    var strings;

    if ( sep ) strings = string.split( sep );
    else strings = [string];

    for ( string of strings ) if ( !/^[a-z][a-z\d]*(?:-[a-z\d]+)*$/.test( string ) ) return false;

    return true;
}

export function isKebabCasePath ( string, { absolute } = {} ) {
    if ( absolute ) {
        if ( !string.startsWith( "/" ) ) return false;

        string = string.substring( 1 );
    }

    return isKebabCase( string, { "sep": "/" } );
}

export function isSnakeCase ( string, { sep, allowProtected } = {} ) {
    var strings;

    if ( sep ) strings = string.split( sep );
    else strings = [string];

    for ( string of strings ) {
        if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

        if ( !/^[a-z][a-z\d]*(?:_[a-z\d]+)*$/.test( string ) ) return false;
    }

    return true;
}

export function isConstantCase ( string, { allowProtected } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

    if ( /^[A-Z][A-Z\d]*(?:_[A-Z\d]+)*$/.test( string ) ) return true;

    return false;
}

export function isCamelCase ( string, { sep, allowProtected, strict } = {} ) {
    var strings;

    if ( sep ) strings = string.split( sep );
    else strings = [string];

    for ( string of strings ) {
        if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

        if ( !/^[a-z](?:[A-Z\d][a-z\d]*)*$/.test( string ) ) return false;

        // should not contains consecutive capital letters
        if ( strict && /[A-Z]{2,}/.test( string ) ) return false;
    }

    return true;
}

export function isPascalCase ( string, { sep, allowProtected, strict } = {} ) {
    var strings;

    if ( sep ) strings = string.split( sep );
    else strings = [string];

    for ( string of strings ) {
        if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

        if ( !/^(?:[A-Z][a-z\d]*)+$/.test( string ) ) return false;

        // should not contains consecutive capital letters
        if ( strict && /[A-Z]{2,}/.test( string ) ) return false;
    }

    return true;
}

export function kebabToCamelCase ( string ) {
    return string.toLowerCase().replaceAll( /-(.)/g, ( match, letter ) => letter.toUpperCase() );
}

export function camelToKebabCase ( string ) {
    return string.replaceAll( /([A-Z])/g, ( match, letter ) => "-" + letter.toLowerCase() );
}
