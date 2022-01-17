const SEPARATORS = new Set( [" ", ";", ","] );
const SET_COOKIE_SEPARATOR = new Set( [";"] );

export function parseContentDispositionHeader ( header ) {
    const res = {},
        tokens = _getTokens( header, SEPARATORS );

    res.type = tokens[0].toLowerCase();

    for ( let n = 1; n < tokens.length; n++ ) {
        const token = tokens[n],
            idx = token.indexOf( "=" );

        res[token.substring( 0, idx ).toLowerCase()] = token.substring( idx + 1 );
    }

    return res;
}

export function parseWwwAuthenticateHeader ( header ) {
    const res = {},
        tokens = _getTokens( header, SEPARATORS );

    res.type = tokens.shift().toLowerCase();

    for ( const token of tokens ) {
        const idx = token.indexOf( "=" );

        res[token.substring( 0, idx ).toLowerCase()] = token.substring( idx + 1 );
    }

    return res;
}

export function parseSetCookieHeader ( header ) {
    const res = {},
        tokens = _getTokens( header, SET_COOKIE_SEPARATOR );

    for ( let n = 0; n < tokens.length; n++ ) {
        const token = tokens[n],
            idx = tokens[n].indexOf( "=" );

        if ( n === 0 ) {
            res.key = token.substring( 0, idx );
            res.value = token.substring( idx + 1 );
        }
        else {
            res[token.substring( 0, idx ).toLowerCase()] = token.substring( idx + 1 );
        }
    }

    return res;
}

function _getTokens ( value, separators ) {
    var tokens = [],
        token = "",
        quoted = false;

    for ( let n = 0; n < value.length; n++ ) {
        const char = value[n];

        // escape
        if ( char === "\\" ) {
            if ( n !== value.length - 1 ) {
                n++;

                token += char;
            }
        }

        // quote
        else if ( char === `"` ) {
            quoted = !quoted;
        }

        // field separator
        else if ( separators.has( char ) ) {
            if ( quoted ) {
                token += char;
            }
            else {

                // unquoted staces are ignored
                if ( token ) tokens.push( token );
                token = "";
            }
        }

        // regular character
        else {
            token += char;
        }
    }

    if ( token ) tokens.push( token );

    return tokens;
}
