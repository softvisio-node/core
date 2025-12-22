import { timingSafeEqual } from "node:crypto";
import constants from "#lib/app/constants";
import { hashSync, randomFill } from "#lib/crypto";

const TOKEN_HASH_ALGORITHM = "SHA3-256",
    TOKEN_RANDOM_MIN_LENGTH = 16,
    DEFAULT_TOKEN_RANDOM_LENGTH = TOKEN_RANDOM_MIN_LENGTH;

export default class Token {
    #app;
    #id;
    #type;
    #token;
    #public;
    #hash;
    #userId;
    #isEnabled;
    #lastAuthorized;
    #hostname;
    #remoteAddress;
    #userAgent;

    constructor ( app, data ) {
        this.#app = app;

        if ( data ) {
            this.#id = data.id;
            this.#type = data.type;
            this.#token = data.token;
            this.#public = data.public;
            this.#hash = data.hash;
            this.#userId = data.user_id;

            this.update( data );
        }
    }

    // static
    static new ( app, token ) {
        if ( !token ) {
            return new this( app );
        }
        else if ( token instanceof Token ) {
            return token;
        }
        else {
            try {
                const buffer = Buffer.from( token, "base64url" ),
                    hash = hashSync( TOKEN_HASH_ALGORITHM, buffer.subarray( 9 ) ),
                    type = buffer.readInt8() ^ hash.readInt8(),
                    id = buffer.readBigInt64BE( 1 ) ^ hash.readBigInt64BE( 1 );

                return new this( app, {
                    "id": Number( id ),
                    type,
                    token,
                    "public": token.slice( 0, 12 ),
                    hash,
                } );
            }
            catch {

                // token is corrupted
                return new this( app );
            }
        }
    }

    static async generate ( app, type, id, { length = DEFAULT_TOKEN_RANDOM_LENGTH } = {} ) {
        if ( length < TOKEN_RANDOM_MIN_LENGTH ) length = TOKEN_RANDOM_MIN_LENGTH;

        const buffer = await randomFill( Buffer.allocUnsafe( 9 + length ), 9 ),
            hash = hashSync( TOKEN_HASH_ALGORITHM, buffer.subarray( 9 ) );

        buffer.writeInt8( type ^ hash.readInt8() );
        buffer.writeBigInt64BE( BigInt( id ) ^ hash.readBigInt64BE( 1 ), 1 );

        const token = buffer.toString( "base64url" );

        return new this( app, {
            id,
            type,
            token,
            "public": token.slice( 0, 12 ),
            hash,
        } );
    }

    // properties
    get app () {
        return this.#app;
    }

    get id () {
        return this.#id;
    }

    get type () {
        return this.#type;
    }

    get token () {
        return this.#token;
    }

    get public () {
        return this.#public;
    }

    get hash () {
        return this.#hash;
    }

    get userId () {
        return this.#userId;
    }

    get isApiToken () {
        return this.#type === constants.apiToken.id;
    }

    get isSessionToken () {
        return this.#type === constants.sessionToken.id;
    }

    get isEnabled () {
        return this.#isEnabled;
    }

    get hostname () {
        return this.#hostname;
    }

    // public
    update ( data ) {
        if ( this.isApiToken ) {
            if ( "enabled" in data ) this.#isEnabled = data.enabled;
        }
        else {
            this.#isEnabled = true;
        }

        if ( this.isSessionToken ) {
            if ( "last_authorized" in data ) this.#lastAuthorized = Date.parse( data.last_authorized );
            if ( "hostname" in data ) this.#hostname = data.hostname;
            if ( "remote_address" in data ) this.#remoteAddress = data.remote_address;
            if ( "user_agent" in data ) this.#userAgent = data.user_agent;
        }
    }

    verify ( token ) {
        return timingSafeEqual( this.#hash, token.hash );
    }

    checkAuthorization ( remoteAddress, userAgent ) {

        // authorization is expired
        if ( this.#lastAuthorized + this.app.api.authorizedSessionMaxAgeInterval.toMilliseconds() < Date.now() ) return false;

        // session signature is invalid
        if ( this.#remoteAddress !== remoteAddress + "" || this.#userAgent !== userAgent + "" ) return false;

        return true;
    }
}
