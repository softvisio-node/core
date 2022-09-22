import { getRandomArrayValue } from "#lib/utils";

// https://therootcompany.com/blog/how-many-bits-of-entropy-per-character/
// https://en.wikipedia.org/wiki/Password_strength#Entropy_as_a_measure_of_password_strength

// 19 bits - common for OTP
// 29 bits - minimum recommendation for online systems
// 96 bits - minimum recommendation for offline systems
// 128 bits - common for API keys
// 256 bits - common for overkill
// 4096 bits - common for prime numbers (sparse keyspace)

const UNICODE_CHAR_LENGTH_ENTROPY = [7, 13, 18, 22, 25, 27, 28];

const PASSWORD_ALPHABETS = {
    "alphaLowercase": "abcdefghijklmnopqrstuvwxyz",
    "alphaUppercase": "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "digits": "0123456789",
    "punctuation": "`-=[]\\;',./~!@#$%^&*()_+{}|:\"<>?",
};

const textEncoder = new TextEncoder();

class Passwords {
    #passwordChars;
    #passwordCharsAlpahbet = {};
    #passwordAlphabetsSize = {};

    // public
    getAlphabetCharEntropy ( alphabetSize ) {
        if ( typeof alphabetSize === "string" ) alphabetSize = alphabetSize.length;

        return Math.log( alphabetSize ) / Math.log( 2 );
    }

    getUnicodeCharEntropy ( char ) {
        return UNICODE_CHAR_LENGTH_ENTROPY[textEncoder.encode( char[0] ).length - 1];
    }

    getPasswordEntropy ( password ) {
        this.#buildPasswordChars();

        const alphabets = new Set(),
            seenChars = new Set();

        var entropy = 0,
            asciiLength = 0;

        for ( const char of password ) {
            if ( seenChars.has( char ) ) continue;
            seenChars.add( char );

            const alphabet = this.#passwordCharsAlpahbet[char];

            if ( alphabet ) {
                asciiLength++;

                alphabets.add( alphabet );
            }
            else {
                entropy += this.getUnicodeCharEntropy( char );
            }
        }

        if ( alphabets.size ) {
            let alphabetSize = 0;

            for ( const alphabet of alphabets ) alphabetSize += this.#passwordAlphabetsSize[alphabet];

            entropy += asciiLength * this.getAlphabetCharEntropy( alphabetSize );
        }

        return entropy;
    }

    generatePassword ( { minEntropy = 96 } = {} ) {
        this.#buildPasswordChars();

        var password = "",
            entropy = 0,
            usedAlphabets = new Set(),
            usedAlphabetSize = 0;

        while ( entropy < minEntropy ) {
            const char = getRandomArrayValue( this.#passwordChars ),
                alphabet = this.#passwordCharsAlpahbet[char];

            password += char;

            if ( !usedAlphabets.has( alphabet ) ) {
                usedAlphabets.add( alphabet );

                usedAlphabetSize += this.#passwordAlphabetsSize[alphabet];
            }

            entropy = password.length * this.getAlphabetCharEntropy( usedAlphabetSize );
        }

        return password;
    }

    // private
    #buildPasswordChars () {
        if ( this.#passwordChars ) return;

        this.#passwordChars = [];

        for ( const [alphabet, chars] of Object.entries( PASSWORD_ALPHABETS ) ) {
            for ( const char of chars ) {
                this.#passwordChars.push( char );

                this.#passwordCharsAlpahbet[char] = alphabet;

                this.#passwordAlphabetsSize[alphabet] = chars.length;
            }
        }

        const asciiNonPrintableCharsAlphabet = [];

        for ( let code = 0; code <= 127; code++ ) {
            const char = String.fromCharCode( code );

            if ( !this.#passwordCharsAlpahbet[char] ) {
                asciiNonPrintableCharsAlphabet.push( char );

                this.#passwordCharsAlpahbet[char] = "asciiNonPrintableChars";
            }
        }

        this.#passwordAlphabetsSize["asciiNonPrintableChars"] = asciiNonPrintableCharsAlphabet.length;
    }
}

export default new Passwords();
