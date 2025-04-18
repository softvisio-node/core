// NOTE: https://en.wikipedia.org/wiki/Naming_convention_(programming)#Multiple-word_identifiers

export function isKebabCase ( string, { allowProtected } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/, "" );

    return /^[a-z][\da-z]*(?:-[\da-z]+)*$/.test( string );
}

export function isSnakeCase ( string, { allowProtected } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/, "" );

    return /^[a-z][\da-z]*(?:_[\da-z]+)*$/.test( string );
}

export function isConstantCase ( string, { allowProtected } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/, "" );

    return /^[A-Z][\dA-Z]*(?:_[\dA-Z]+)*$/.test( string );
}

export function isCamelCase ( string, { allowProtected, strict } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/, "" );

    if ( strict ) {
        return /^[a-z][\da-z]*(?:[A-Z][\da-z]+)*[A-Z]?$/.test( string );
    }
    else {
        return /^[a-z][\da-z]*(?:[A-Z]+[\da-z]*)*$/.test( string );
    }
}

export function isPascalCase ( string, { allowProtected, strict } = {} ) {
    if ( allowProtected && string.startsWith( "_" ) ) string = string.replace( /^_+/, "" );

    if ( strict ) {
        return /^(?:[A-Z]|(?:[A-Z][\da-z]+)+[A-Z]?)$/.test( string );
    }
    else {
        return /^(?:[A-Z][\dA-Za-z]*)+$/.test( string );
    }
}

export function kebabToSnakeCase ( string ) {
    return string.toLowerCase().replaceAll( "-", "_" );
}

export function kebabToCamelCase ( string ) {
    return string.toLowerCase().replaceAll( /-(.)/g, ( match, letter ) => letter.toUpperCase() );
}

export function snakeToKebabCase ( string ) {
    return string.toLowerCase().replaceAll( /([\da-z])_([\da-z])/g, ( match, letter1, letter2 ) => letter1 + "-" + letter2 );
}

export function snakeToCamelCase ( string ) {
    return string.toLowerCase().replaceAll( /([\da-z])_([\da-z])/g, ( match, letter1, letter2 ) => letter1 + letter2.toUpperCase() );
}

export function camelToKebabCase ( string ) {
    return string.replaceAll( /([A-Z])/g, ( match, letter ) => "-" + letter.toLowerCase() );
}

export function camelToSnakeCase ( string ) {
    return string.replaceAll( /([A-Z])/g, ( match, letter ) => "_" + letter.toLowerCase() );
}

export function camelToConstantCase ( string ) {
    return string.replaceAll( /([A-Z])/g, ( match, letter ) => "_" + letter ).toUpperCase();
}

export function camelToPascalCase ( string ) {
    return string.replace( /^(_*)([a-z])/, ( match, prefix, letter ) => prefix + letter.toUpperCase() );
}

export function validatePath ( string, { root, absolute, folder, format } = {} ) {

    // root
    if ( string === "/" ) {
        if ( root ) {
            return true;
        }
        else {
            return false;
        }
    }

    // start
    if ( string.startsWith( "/" ) ) {
        if ( absolute === false ) return false;

        string = string.slice( 1 );
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

    if ( format ) {

        // kebab case
        if ( format === "kebab-case" ) {
            for ( const segment of string.split( "/" ) ) {
                if ( !isKebabCase( segment ) ) return false;
            }
        }

        // snake case
        else if ( format === "snake-case" ) {
            for ( const segment of string.split( "/" ) ) {
                if ( !isSnakeCase( segment ) ) return false;
            }
        }

        // constant case
        else if ( format === "constant-case" ) {
            for ( const segment of string.split( "/" ) ) {
                if ( !isConstantCase( segment ) ) return false;
            }
        }

        // camel case
        else if ( format === "camel-case" ) {
            for ( const segment of string.split( "/" ) ) {
                if ( !isCamelCase( segment ) ) return false;
            }
        }

        // pascal case
        else if ( format === "pascal-case" ) {
            for ( const segment of string.split( "/" ) ) {
                if ( !isPascalCase( segment ) ) return false;
            }
        }

        // invalid format
        else {
            return false;
        }
    }

    return true;
}
