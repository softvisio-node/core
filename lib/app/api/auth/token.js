import crypto from "crypto";

import CONST from "#lib/const";

export default class Token {
    static getHash ( buffer ) {
        return crypto.createHash( "SHA3-512" ).update( buffer ).digest( "base64" );
    }

    static new ( token ) {
        if ( token instanceof Token ) {
            return token;
        }
        else if ( Array.isArray( token ) ) {
            const username = token[0].toLowerCase();

            // password + username (salt)
            return new this( CONST.AUTH_USER, username, this.getHash( token[1] + username ) );
        }
        else {
            try {
                const buf = Buffer.from( token, "base64url" );

                const type = buf.readUInt8( 8 );
                const id = buf.readBigInt64BE() ^ ~buf.readBigInt64BE( 9 );

                return new this( type, id.toString(), this.getHash( buf ) );
            }
            catch ( e ) {}
        }
    }

    static generate ( type, id ) {
        const length = 16;

        const buf = crypto.randomFillSync( Buffer.allocUnsafe( 9 + length ), 0, length );

        buf.writeUInt8( type, 8 );
        buf.writeBigInt64BE( BigInt( id ) ^ ~buf.readBigInt64BE( 9 ) );

        return new this( type, id, this.getHash( buf ), buf.toString( "base64url" ) );
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
