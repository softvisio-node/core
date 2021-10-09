// NOTE https://en.wikipedia.org/wiki/Naming_convention_(programming)#Multiple-word_identifiers

export function isKebabCase ( string ) {
    return /^[a-z]+(?:-[a-z\d]+)*$/.test( string );
}

export function isSnakeCase ( string, options ) {
    if ( options?.protected ) {
        return /^_?[a-z](?:_[a-z\d]+)*$/.test( string );
    }
    else {
        return /^[a-z](?:_[a-z\d]+)*$/.test( string );
    }
}

export function isConstantCase ( string, options ) {
    if ( options?.protected ) {
        return /^_?[A-Z](?:_[A-Z\d]+)*$/.test( string );
    }
    else {
        return /^[A-Z](?:_[A-Z\d]+)*$/.test( string );
    }
}

export function isCamelCase ( string, options ) {
    if ( options?.protected && string.startsWith( "_" ) ) string = string.replaceAll( /^_+/g, "" );

    if ( !/^[a-z](?:[A-Z\d][a-z\d]*)*$/.test( string ) ) return false;

    // should not contains consecutive capital letters
    if ( options?.strict && /[A-Z]+/.test( string ) ) return false;

    return true;
}

export function isPascalCase ( string, options ) {
    if ( options?.protected && string.startsWith( "_" ) ) string = string.replaceAll( /^_+/g, "" );

    if ( !/^(?:[A-Z][a-z\d]*)+$/.test( string ) ) return false;

    // should not contains consecutive capital letters
    if ( options?.strict && /[A-Z]+/.test( string ) ) return false;

    return true;
}
