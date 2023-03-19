// NOTE https://en.wikipedia.org/wiki/Naming_convention_(programming)#Multiple-word_identifiers

// XXX
export function isKebabCase ( string, { sep } = {} ) {
    var strings;

    if ( sep ) strings = string.split( sep );
    else strings = [string];

    for ( string of strings ) if ( !/^[a-z][a-z\d]*(?:-[a-z\d]+)*$/.test( string ) ) return false;

    return true;
}

// XXX
export function isKebabCasePath ( string, { absolute } = {} ) {
    if ( absolute ) {
        if ( !string.startsWith( "/" ) ) return false;

        string = string.substring( 1 );
    }

    return isKebabCase( string, { "sep": "/" } );
}

export function isSnakeCase ( string, { allowProtected } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

    return /^[a-z][a-z\d]*(?:_[a-z\d]+)*$/.test( string );
}

export function isConstantCase ( string, { allowProtected } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

    return /^[A-Z][A-Z\d]*(?:_[A-Z\d]+)*$/.test( string );
}

export function isCamelCase ( string, { allowProtected, strict } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

    if ( strict ) {
        return /^[a-z][a-z\d]*(?:[A-Z][a-z\d]+)*[A-Z]?$/.test( string );
    }
    else {
        return /^[a-z][a-z\d]*(?:[A-Z]+[a-z\d]*)*$/.test( string );
    }
}

export function isPascalCase ( string, { allowProtected, strict } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

    if ( strict ) {
        return /^(?:[A-Z]|(?:[A-Z][a-z\d]+)+[A-Z]?)$/.test( string );
    }
    else {
        return /^(?:[A-Z][A-Za-z\d]*)+$/.test( string );
    }
}

export function kebabToCamelCase ( string ) {
    return string.toLowerCase().replaceAll( /-(.)/g, ( match, letter ) => letter.toUpperCase() );
}

export function camelToKebabCase ( string ) {
    return string.replaceAll( /([A-Z])/g, ( match, letter ) => "-" + letter.toLowerCase() );
}
