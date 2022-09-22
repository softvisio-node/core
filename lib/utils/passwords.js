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
    #passwordCharsEntropy;

    // public
    getAlphabetCharEntropy ( alphabetSize ) {
        if ( typeof alphabetSize === "string" ) alphabetSize = alphabetSize.length;

        return Math.log( alphabetSize ) / Math.log( 2 );
    }

    getUnicodeCharEntropy ( char ) {
        return UNICODE_CHAR_LENGTH_ENTROPY[textEncoder.encode( char[0] ).length - 1];
    }

    getPasswordEntropy ( password ) {
        this.#buildPasswordCharsEntropy();

        var entropy = 0;

        for ( const char of password ) {
            const charEntropy = this.#passwordCharsEntropy[char];

            if ( charEntropy ) {
                entropy += charEntropy;
            }
            else {
                entropy += this.getUnicodeCharEntropy( char );
            }
        }

        return entropy;
    }

    generatePassword ( { minEntropy = 96 } = {} ) {
        this.#buildPasswordCharsEntropy();

        var password = "",
            entropy = 0;

        while ( entropy < minEntropy ) {
            const char = getRandomArrayValue( this.#passwordChars );

            password += char;

            entropy += this.#passwordCharsEntropy[char];
        }

        return password;
    }

    // private
    #buildPasswordCharsEntropy () {
        if ( this.#passwordCharsEntropy ) return;

        this.#passwordChars = [];
        this.#passwordCharsEntropy = {};

        for ( const alphabet of Object.values( PASSWORD_ALPHABETS ) ) {
            const alphabetCharEntropy = this.getAlphabetCharEntropy( alphabet );

            for ( const char of alphabet ) {
                this.#passwordChars.push( char );

                this.#passwordCharsEntropy[char] = alphabetCharEntropy;
            }
        }

        const asciiAlphabet = [];

        for ( let code = 0; code <= 127; code++ ) {
            const char = String.fromCharCode( code );

            if ( this.#passwordCharsEntropy[char] == null ) asciiAlphabet.push( char );
        }

        const asciiAlphabetCharEntropy = this.getAlphabetCharEntropy( asciiAlphabet );

        for ( const char of asciiAlphabet ) {
            this.#passwordCharsEntropy[char] = asciiAlphabetCharEntropy;
        }
    }
}

export default new Passwords();
