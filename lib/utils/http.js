const SEPARATORS = new Set( [" ", ";", ","] );

export function parseContentDispositionHeader ( header ) {
    const res = {},
        tokens = _getTokens( header );

    res.type = tokens[0].toLowerCase();

    for ( let n = 1; n < tokens.length; n++ ) {
        const token = tokens[n],
            idx = token.indexOf( "=" );

        res[token.substring( 0, idx ).toLowerCase()] = token.substr( idx + 1 );
    }

    return res;
}

export function parseWwwAuthenticateHeader ( header ) {
    const res = {},
        tokens = _getTokens( header );

    res.type = tokens[0].toLowerCase();

    for ( let n = 1; n < tokens.length; n++ ) {
        const token = tokens[n],
            idx = tokens[n].indexOf( "=" );

        res[token.substring( 0, idx ).toLowerCase()] = token.substr( idx + 1 );
    }

    return res;
}

export function parseSetCookieHeader ( header ) {
    const res = {},
        tokens = _getTokens( header );

    for ( let n = 0; n < tokens.length; n++ ) {
        const token = tokens[n],
            idx = tokens[n].indexOf( "=" );

        if ( !n ) {
            res.key = token.substring( 0, idx );
            res.value = token.substr( idx + 1 );
        }
        else {
            res[token.substring( 0, idx ).toLowerCase()] = token.substr( idx + 1 );
        }
    }

    return res;
}

function _getTokens ( header ) {
    var tokens = [],
        token = "",
        quoted = false;

    for ( let n = 0; n < header.length; n++ ) {
        const char = header[n];

        // escape
        if ( char === "\\" ) {
            if ( n !== header.length - 1 ) {
                n++;

                token += char;
            }
        }

        // quote
        else if ( char === `"` ) {
            quoted = !quoted;
        }

        // field separator
        else if ( SEPARATORS.has( char ) ) {
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
