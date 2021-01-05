const crypto = require( "crypto" );
const { toBase58, fromBase58 } = require( "../util" );

const CONST = require( "../const" );

class Token {
    static getHash ( buffer ) {
        return crypto.createHash( "SHA3-512" ).update( buffer ).digest( "base64" );
    }

    static createToken ( token ) {
        if ( Array.isArray( token ) ) {
            const username = token[0].toLowerCase();

            // password + username (salt)
            return new this( CONST.TOKEN_TYPE_PASSWORD, username, this.getHash( token[1] + username ) );
        }
        else {
            try {
                const buf = fromBase58( token );

                const id = buf.readBigUInt64LE();

                return new this( Number( id >> 55n ), id.toString(), this.getHash( buf ) );
            }
            catch ( e ) {}
        }
    }

    static generateToken ( id ) {
        const type = Number( id >> 55n );

        var buf = Buffer.allocUnsafe( 8 );
        buf.writeBigUInt64LE( BigInt( id ) );

        var length;

        if ( type === CONST.TOKEN_TYPE_TOKEN ) length = 16;
        else if ( type === CONST.TOKEN_TYPE_SESSION ) length = 24;
        else length = 16;

        buf = Buffer.concat( [buf, crypto.randomBytes( length )] );

        return new this( id, type, this.getHash( buf ), toBase58( buf ) );
    }

    #type;
    #id;
    #hash;
    #token;

    constructor ( type, id, hash, token ) {
        this.#type = type;
        this.#id = id;
        this.#hash = hash;
        this.#token = token;
    }

    get id () {
        return this.#id;
    }

    get type () {
        return this.#type;
    }

    get hash () {
        return this.#hash;
    }

    get token () {
        return this.#token;
    }
}

module.exports = Token;
