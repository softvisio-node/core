import crypto from "node:crypto";

const ALPHABETS = {
    "alphaLowercase": "abcdefghijklmnopqrstuvwxyz",
    "alphaUppercase": "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "digits": "0123456789",
    "punctuation": "`-=[]\\;',./~!@#$%^&*()_+{}|:\"<>?",
};

function getAlphabetSize ( str ) {
    var alphabetSize = 0;

    const seenChars = new Set(),
        usedAlphabets = new Set();

    CHAR: for ( let n = 0; n < str.length; n++ ) {
        const char = str[n];

        // speed optimization, process each character once
        if ( seenChars.has( char ) ) continue;
        seenChars.add( char );

        for ( const [alphabet, chars] of Object.entries( ALPHABETS ) ) {
            if ( chars.includes( char ) ) {
                if ( !usedAlphabets.has( alphabet ) ) alphabetSize += chars.length;

                usedAlphabets.add( alphabet );

                continue CHAR;
            }
        }

        // I can only guess the size of a non-western alphabet.
        // The choice here is to grant the size of the western alphabet, together
        // with an additional bonus for the character itself.
        // if ( char.charCodeAt( 0 ) > 127 ) {
        //     collect.alphaLowercase = 26;

        //     collect.unicode += 1;
        // }
    }

    return alphabetSize;
}

// https://en.wikipedia.org/wiki/Password_strength#Entropy_as_a_measure_of_password_strength
export function entropy ( str ) {
    if ( !str ) return 0;

    return str.length * ( Math.log( getAlphabetSize( str ) ) / Math.log( 2 ) );

    // return Math.round( str.length * ( Math.log( getAlphabetSize( str ) ) / Math.log( 2 ) ) );
}

export function generatePassword () {
    return crypto.randomBytes( 16 ).toString( "base64url" );
}
