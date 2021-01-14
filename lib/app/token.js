const crypto = require( "crypto" );
const { toBase64u, fromBase64u } = require( "../util" );

const { AUTH_USER, AUTH_SESSION } = require( "../const" );

class Token {
    static getHash ( buffer ) {
        return crypto.createHash( "SHA3-512" ).update( buffer ).digest( "base64" );
    }

    static createToken ( token ) {
        if ( Array.isArray( token ) ) {
            const username = token[0].toLowerCase();

            // password + username (salt)
            return new this( AUTH_USER, username, this.getHash( token[1] + username ) );
        }
        else {
            try {
                const buf = fromBase64u( token );

                const type = buf.readUInt8( 8 );
                const id = buf.readBigInt64BE() ^ ~buf.readBigInt64BE( 9 );

                return new this( type, id.toString(), this.getHash( buf ) );
            }
            catch ( e ) {}
        }
    }

    static generateToken ( type, id ) {
        const length = type === AUTH_SESSION ? 24 : 16;

        const buf = Buffer.allocUnsafe( 9 + length );
        crypto.randomBytes( length ).copy( buf, 9 );

        buf.writeUInt8( type, 8 );
        buf.writeBigInt64BE( BigInt( id ) ^ ~buf.readBigInt64BE( 9 ) );

        return new this( type, id, this.getHash( buf ), toBase64u( buf ) );
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
