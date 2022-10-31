import crypto from "crypto";
import constants from "#lib/app/constants";

const TOKEN_RANDOM_MIN_LENGTH = 6,
    DEFAULT_TOKEN_RANDOM_LENGTH = 16;

export default class Token {
    #api;
    #id;
    #type;
    #fingerprint;
    #token;
    #hash;
    #userId;
    #isEnabled;
    #lastAuthorized;
    #hostname;
    #remoteAddress;
    #userAgent;

    constructor ( api, data ) {
        this.#api = api;

        if ( data ) {
            this.#id = data.id;
            this.#token = data.token;
            this.#type = data.type;
            this.#fingerprint = data.fingerprint;
            this.#hash = data.hash;
            this.#userId = data.user_id;

            this.update( data );
        }
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

                const type = buf.readInt8() ^ buf.readInt8( 9 ),
                    id = buf.readBigInt64BE( 1 ) ^ buf.readBigInt64BE( 9 ),
                    fingerprint = buf.readInt16BE( 9 );

                return new this( api, {
                    token,
                    "id": id.toString(),
                    type,
                    fingerprint,
                } );
            }
            catch ( e ) {

                // token is corrupted
                return new this( api );
            }
        }
    }

    static generate ( api, type, id, { length = DEFAULT_TOKEN_RANDOM_LENGTH } = {} ) {
        if ( length < TOKEN_RANDOM_MIN_LENGTH ) length = TOKEN_RANDOM_MIN_LENGTH;

        const buf = crypto.randomFillSync( Buffer.allocUnsafe( 9 + 2 + length ), 9, length ),
            fingerprint = buf.readInt16BE( 9 );

        buf.writeInt8( type ^ buf.readInt8( 9 ) );
        buf.writeBigInt64BE( BigInt( id ) ^ buf.readBigInt64BE( 9 ), 1 );

        return new this( api, {
            "token": buf.toString( "base64url" ),
            id,
            type,
            fingerprint,
        } );
    }

    // properties
    get token () {
        return this.#token;
    }

    get id () {
        return this.#id;
    }

    get type () {
        return this.#type;
    }

    get fingerprint () {
        return this.#fingerprint;
    }

    get userId () {
        return this.#userId;
    }

    get isUserToken () {
        return this.#type === constants.tokenTypeUserToken;
    }

    get isUserSessionToken () {
        return this.#type === constants.tokenTypeUserSession;
    }

    get isEnabled () {
        return this.#isEnabled;
    }

    // public
    update ( data ) {
        if ( this.isUserToken ) {
            if ( "enabled" in data ) this.#isEnabled = data.enabled;
        }
        else {
            this.#isEnabled = true;
        }

        if ( this.isUserSessionToken ) {
            if ( "last_authorized" in data ) this.#lastAuthorized = Date.parse( data.last_authorized );
            if ( "hostname" in data ) this.#hostname = data.hostname;
            if ( "remote_address" in data ) this.#remoteAddress = data.remote_address;
            if ( "user_agent" in data ) this.#userAgent = data.user_agent;
        }
    }

    async getHash () {
        if ( !this.#token ) throw Error( `Token is not defined` );

        this.#hash ??= this.#api.argon2.createHash( this.#token );

        return this.#hash;
    }

    async verify ( token ) {
        if ( !token.id ) {
            if ( this.#id ) {
                return false;
            }
            else {
                return true;
            }
        }

        if ( this.#token ) {
            if ( this.#token === token.token ) {
                return true;
            }
            else {
                return false;
            }
        }

        if ( this.#type !== token.type ) return false;
        if ( this.#id !== token.id ) return false;
        if ( this.#fingerprint !== token.fingerprint ) return false;

        if ( await this.#api.argon2.verifyHash( this.#hash, token.token ) ) {
            this.#token = token.token;

            return true;
        }
        else {
            return false;
        }
    }
}
