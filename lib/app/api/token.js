import crypto from "crypto";
import constants from "#lib/app/constants";

const TOKEN_RANDOM_MIN_LENGTH = 9,
    DEFAULT_TOKEN_RANDOM_LENGTH = 16;

function getHash ( buffer ) {
    return crypto.createHash( "SHA3-512" ).update( buffer ).digest( "base64" );
}

export default class Token {
    #api;
    #id;
    #type;
    #cacheId;
    #hash;
    #token;
    #isCorrupted;

    constructor ( api, { id, type, hash, token, isCorrupted } = {} ) {
        this.#api = api;
        this.#id = id;
        this.#type = type;
        this.#hash = hash;
        this.#token = token;
        this.#isCorrupted = isCorrupted;

        if ( type ) this.#cacheId = type + "/" + id;
    }

    // static
    static new ( api, token ) {
        if ( !token ) {
            return new this( api );
        }
        else if ( token instanceof Token ) {
            return token;
        }
        else {
            try {
                const buf = Buffer.from( token, "base64url" );

                const type = buf.readInt8() ^ buf.readInt8( 9 );
                const id = buf.readBigInt64BE( 1 ) ^ buf.readBigInt64BE( 10 );

                return new this( api, {
                    "id": id.toString(),
                    type,
                    "hash": getHash( buf ),
                } );
            }
            catch ( e ) {

                // token is corrupted
                return new this( api, {
                    "isCorrupted": true,
                } );
            }
        }
    }

    static generate ( api, type, id, { length = DEFAULT_TOKEN_RANDOM_LENGTH } = {} ) {
        if ( length < TOKEN_RANDOM_MIN_LENGTH ) length = TOKEN_RANDOM_MIN_LENGTH;

        const buf = crypto.randomFillSync( Buffer.allocUnsafe( 9 + length ), 9, length );

        buf.writeInt8( type ^ buf.readInt8( 9 ) );
        buf.writeBigInt64BE( BigInt( id ) ^ buf.readBigInt64BE( 10 ), 1 );

        return new this( api, {
            id,
            type,
            "hash": getHash( buf ),
            "token": buf.toString( "base64url" ),
        } );
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

    get isValid () {
        return !this.#isCorrupted;
    }

    get isUserToken () {
        return this.#type === constants.tokenTypeUserToken;
    }

    get isUserSessionToken () {
        return this.#type === constants.tokenTypeUserSession;
    }
}
