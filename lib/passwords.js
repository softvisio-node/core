import result from "#lib/result";
import { getRandomArrayValue } from "#lib/utils";

// https://therootcompany.com/blog/how-many-bits-of-entropy-per-character/
// https://en.wikipedia.org/wiki/Password_strength#Entropy_as_a_measure_of_password_strength

// 19 bits - common for OTP
// 29 bits - minimum recommendation for online systems
// 96 bits - minimum recommendation for offline systems
// 128 bits - common for API keys
// 256 bits - common for overkill
// 4096 bits - common for prime numbers (sparse keyspace)

const PASSWORD_STRENGTH_ENTROPY = {
    "weak": { "minEntropy": null, "maxEntropy": 45 },
    "normal": { "minEntropy": 45, "maxEntropy": 95 },
    "strong": { "minEntropy": 95, "maxEntropy": null },
};

const PASSWORD_ALPHABETS = {
    "alphaLowercase": "abcdefghijklmnopqrstuvwxyz",
    "alphaUppercase": "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "digits": "0123456789",
    "punctuation": "`-=[]\\;',./~!@#$%^&*()_+{}|:\"<>?",
};

const generatePasswordsAlphabets = new Set( [ "alphaLowercase", "alphaUppercase", "digits" ] );

class Passwords {
    #passwordChars;
    #passwordCharsAlpahbet = {};
    #passwordAlphabetsSize = {};

    // public
    getStringEntropy ( string, alphabetSize ) {
        if ( !string ) return 0;

        return Math.round( string.length * this.getAlphabetCharEntropy( alphabetSize ) );
    }

    getAlphabetCharEntropy ( alphabetSize ) {
        if ( typeof alphabetSize === "string" ) alphabetSize = alphabetSize.length;

        return Math.log( alphabetSize ) / Math.log( 2 );
    }

    getPasswordEntropy ( password ) {
        this.#buildPasswordChars();

        const alphabets = new Set();

        password ||= "";

        for ( const char of password ) {
            const alphabet = this.#passwordCharsAlpahbet[ char ];

            if ( alphabet ) {
                alphabets.add( alphabet );
            }

            // unicode character
            else {
                alphabets.add( "alphaLowercase" );
            }
        }

        var alphabetSize = 0;
        for ( const alphabet of alphabets ) alphabetSize += this.#passwordAlphabetsSize[ alphabet ];

        const entropy = this.getStringEntropy( password, alphabetSize );

        return {
            password,
            entropy,
            "strength": this.#getPasswordEntropyStrenth( entropy ),
        };
    }

    checkPasswordStrength ( password, { strength = "strong" } = {} ) {
        const entropy = this.getPasswordEntropy( password );

        const { minEntropy } = PASSWORD_STRENGTH_ENTROPY[ strength ];

        if ( minEntropy && entropy.entropy < minEntropy ) return result( [ 400, "Password is weak" ], entropy );

        return result( [ 200, "Password is strong" ], entropy );
    }

    generatePassword ( { strength = "strong" } = {} ) {
        const { minEntropy, maxEntropy } = PASSWORD_STRENGTH_ENTROPY[ strength ];

        this.#buildPasswordChars();

        var password = "",
            entropy = 0,
            usedAlphabets = new Set(),
            usedAlphabetSize = 0;

        while ( true ) {
            const char = getRandomArrayValue( this.#passwordChars ),
                alphabet = this.#passwordCharsAlpahbet[ char ];

            if ( !usedAlphabets.has( alphabet ) ) {
                usedAlphabets.add( alphabet );

                usedAlphabetSize += this.#passwordAlphabetsSize[ alphabet ];
            }

            const newEntropy = this.getStringEntropy( password + char, usedAlphabetSize );

            if ( maxEntropy && newEntropy >= maxEntropy ) break;

            password += char;
            entropy = newEntropy;

            if ( minEntropy && entropy >= minEntropy ) break;
        }

        return {
            password,
            entropy,
            "strength": this.#getPasswordEntropyStrenth( entropy ),
        };
    }

    generateOtp ( { minEntropy = 19 } = {} ) {
        var password = "",
            entropy = 0;

        while ( entropy < minEntropy ) {
            const char = getRandomArrayValue( PASSWORD_ALPHABETS.digits );

            password += char;

            entropy = this.getStringEntropy( password, 10 );
        }

        return {
            password,
            entropy,
        };
    }

    // private
    #buildPasswordChars () {
        if ( this.#passwordChars ) return;

        this.#passwordChars = [];

        for ( const [ alphabet, chars ] of Object.entries( PASSWORD_ALPHABETS ) ) {
            for ( const char of chars ) {
                if ( generatePasswordsAlphabets.has( alphabet ) ) this.#passwordChars.push( char );

                this.#passwordCharsAlpahbet[ char ] = alphabet;

                this.#passwordAlphabetsSize[ alphabet ] = chars.length;
            }
        }

        const asciiNonPrintableCharsAlphabet = [];

        for ( let code = 0; code <= 127; code++ ) {
            const char = String.fromCodePoint( code );

            if ( !this.#passwordCharsAlpahbet[ char ] ) {
                asciiNonPrintableCharsAlphabet.push( char );

                this.#passwordCharsAlpahbet[ char ] = "asciiNonPrintableChars";
            }
        }

        this.#passwordAlphabetsSize[ "asciiNonPrintableChars" ] = asciiNonPrintableCharsAlphabet.length;
    }

    #getPasswordEntropyStrenth ( entropy ) {
        for ( const [ strength, { minEntropy, maxEntropy } ] of Object.entries( PASSWORD_STRENGTH_ENTROPY ) ) {
            if ( minEntropy && entropy < minEntropy ) continue;

            if ( maxEntropy && entropy >= maxEntropy ) continue;

            return strength;
        }
    }
}

export default new Passwords();
