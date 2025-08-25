import { timingSafeEqual } from "node:crypto";
import constants from "#lib/app/constants";
import { hash, randomFill } from "#lib/crypto";
import Interval from "#lib/interval";

const TOKEN_HASH = "SHA3-256",
    TOKEN_RANDOM_MIN_LENGTH = 16,
    DEFAULT_TOKEN_RANDOM_LENGTH = TOKEN_RANDOM_MIN_LENGTH;

export default class Token {
    #app;
    #id;
    #type;
    #token;
    #randomBytes;
    #hash;
    #userId;
    #isEnabled;
    #lastAuthorized;
    #hostname;
    #remoteAddress;
    #userAgent;
    #authorizedSessionMaxAge;

    constructor ( app, data ) {
        this.#app = app;

        if ( data ) {
            this.#id = data.id;
            this.#type = data.type;
            this.#token = data.token;
            this.#randomBytes = data.randomBytes;
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
                const buf = Buffer.from( token, "base64url" );

                const type = buf.readInt8() ^ buf.readInt8( 9 ),
                    id = buf.readBigInt64BE( 1 ) ^ buf.readBigInt64BE( 9 );

                return new this( app, {
                    "id": Number( id ),
                    type,
                    token,
                    "randomBytes": buf.subarray( 9 ),
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

        const buf = await randomFill( Buffer.allocUnsafe( 9 + 2 + length ), 9 );

        buf.writeInt8( type ^ buf.readInt8( 9 ) );
        buf.writeBigInt64BE( BigInt( id ) ^ buf.readBigInt64BE( 9 ), 1 );

        return new this( app, {
            id,
            type,
            "token": buf.toString( "base64url" ),
            "randomBytes": buf.subarray( 9 ),
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

    async getHash () {
        if ( !this.#hash ) {
            if ( !this.#randomBytes ) throw new Error( "Unable to create token hash" );

            this.#hash = await hash( TOKEN_HASH, this.#randomBytes );
        }

        return this.#hash;
    }

    async verify ( token ) {
        if ( this.#id !== token.id ) return false;
        if ( this.#type !== token.type ) return false;

        if ( this.#token && this.#token === token.token ) return true;

        if ( timingSafeEqual( this.#hash, await token.getHash() ) ) {
            this.#token = token.token;

            return true;
        }
        else {
            return false;
        }
    }

    // XXX api
    checkAuthorization ( remoteAddress, userAgent ) {

        // authorization is expired
        // XXX api
        this.#authorizedSessionMaxAge ??= new Interval( this.app.api.config.authorizedSessionMaxAge ).toMilliseconds();
        if ( this.#lastAuthorized + this.#authorizedSessionMaxAge < Date.now() ) return false;

        // session signature is invalid
        if ( this.#remoteAddress !== remoteAddress + "" || this.#userAgent !== userAgent + "" ) return false;

        return true;
    }
}
