import crypto from "crypto";
import constants from "#lib/app/constants";

const DEFAULT_TOKEN_RANDOM_LENGTH = 24;

function getHash ( buffer ) {
    return crypto.createHash( "SHA3-512" ).update( buffer ).digest( "base64" );
}

export default class Token {
    #type;
    #id;
    #cacheId;
    #hash;
    #token;

    constructor ( type, id, hash, token ) {
        this.#type = type;
        this.#id = id;
        this.#hash = hash;
        this.#token = token;

        this.#cacheId = type + "/" + id;
    }

    // static
    static new ( token ) {
        if ( token instanceof Token ) {
            return token;
        }
        else {
            try {
                const buf = Buffer.from( token, "base64url" );

                const type = buf.readInt8() ^ buf.readInt8( 9 );
                const id = buf.readBigInt64BE( 1 ) ^ buf.readBigInt64BE( 10 );

                return new this( type, id.toString(), getHash( buf ) );
            }
            catch ( e ) {}
        }
    }

    static generate ( type, id, { length = DEFAULT_TOKEN_RANDOM_LENGTH } = {} ) {
        const buf = crypto.randomFillSync( Buffer.allocUnsafe( 9 + length ), 9, length );

        buf.writeInt8( type ^ buf.readInt8( 9 ) );
        buf.writeBigInt64BE( BigInt( id ) ^ buf.readBigInt64BE( 10 ), 1 );

        return new this( type, id, getHash( buf ), buf.toString( "base64url" ) );
    }

    // properties
    get id () {
        return this.#id;
    }

    get cacheId () {
        return this.#cacheId;
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

    get isUserToken () {
        return this.#type === constants.tokenTypeUserToken;
    }

    get isUserSessionToken () {
        return this.#type === constants.tokenTypeUserSession;
    }
}
