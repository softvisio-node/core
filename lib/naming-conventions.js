// NOTE https://en.wikipedia.org/wiki/Naming_convention_(programming)#Multiple-word_identifiers

export function isKebabCase ( string ) {
    return /^[a-z][\da-z]*(?:-[\da-z]+)*$/.test( string );
}

export function isKebabCasePath ( string, { allowRoot = true, absolute, folder } = {} ) {

    // root
    if ( string === "/" ) {
        if ( allowRoot ) {
            return true;
        }
        else {
            return false;
        }
    }

    // start
    if ( string.startsWith( "/" ) ) {
        if ( absolute === false ) return false;

        string = string.substring( 1 );
    }
    else if ( absolute === true ) {
        return false;
    }

    // end
    if ( string.endsWith( "/" ) ) {
        if ( folder === false ) return false;

        string = string.slice( 0, -1 );
    }
    else if ( folder === true ) {
        return false;
    }

    // kebab-case
    return /^[\da-z]+(?:-[\da-z]+)*(?:\/[\da-z]+(?:-[\da-z]+)*)*$/.test( string );
}

export function isSnakeCase ( string, { allowProtected } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

    return /^[a-z][\da-z]*(?:_[\da-z]+)*$/.test( string );
}

export function isConstantCase ( string, { allowProtected } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

    return /^[A-Z][\dA-Z]*(?:_[\dA-Z]+)*$/.test( string );
}

export function isCamelCase ( string, { allowProtected, strict } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

    if ( strict ) {
        return /^[a-z][\da-z]*(?:[A-Z][\da-z]+)*[A-Z]?$/.test( string );
    }
    else {
        return /^[a-z][\da-z]*(?:[A-Z]+[\da-z]*)*$/.test( string );
    }
}

export function isPascalCase ( string, { allowProtected, strict } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/g, "" );

    if ( strict ) {
        return /^(?:[A-Z]|(?:[A-Z][\da-z]+)+[A-Z]?)$/.test( string );
    }
    else {
        return /^(?:[A-Z][\dA-Za-z]*)+$/.test( string );
    }
}

export function kebabToCamelCase ( string ) {
    return string.toLowerCase().replaceAll( /-(.)/g, ( match, letter ) => letter.toUpperCase() );
}

export function camelToKebabCase ( string ) {
    return string.replaceAll( /([A-Z])/g, ( match, letter ) => "-" + letter.toLowerCase() );
}
