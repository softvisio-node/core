import crypto from "node:crypto";
import CacheLru from "#lib/cache/lru";
import PasswordHash from "#lib/crypto/password-hash";
import stream from "#lib/stream";

const PASSWORD_HASH_CACHE = new CacheLru( { "maxSize": 100 } ),
    OPENSSL_DEFAULT_PRESET = "pbkdf2",
    OPENSSL_DEFAULT_ALGORITHM = "AES-256-CBC",
    OPENSSL_SALT_BUFFER = Buffer.from( "Salted__" ),
    DEFAULT_AUTH_TAG_LENGTH = 16,
    AUTH_TAG_CIPHERS = new Set( [ "CHACHA20-POLY1305", "gcm", "ocb", "ccm" ] ),
    CIPHERS = {};

// public
export class Hash extends stream.Transform {
    #hash;
    #outputEncoding;

    constructor ( algorithm, { outputEncoding } = {} ) {
        super();

        this.#hash = crypto.createHash( algorithm );
        this.#outputEncoding = outputEncoding;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        this.#hash.update( chunk, encoding );

        callback();
    }

    _flush ( callback ) {
        callback( null, this.#hash.digest( this.#outputEncoding ) );

        this.#hash = null;
    }
}

export class Hmac extends stream.Transform {
    #hmac;
    #outputEncoding;

    constructor ( algorithm, key, { outputEncoding } = {} ) {
        super();

        this.#hmac = crypto.createHash( algorithm, key );
        this.#outputEncoding = outputEncoding;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        this.#hmac.update( chunk, encoding );

        callback();
    }

    _flush ( callback ) {
        callback( null, this.#hmac.digest( this.#outputEncoding ) );

        this.#hmac = null;
    }
}

export class Encrypt extends stream.Transform {
    #init;
    #options;
    #cipherInfo;
    #cipher;

    constructor ( { init, ...options } = {} ) {
        super();

        this.#init = init || opensslInit;
        this.#options = options;
    }

    // protected
    async _transform ( chunk, encoding, callback ) {

        // init
        if ( this.#init ) {
            try {
                const res = await this.#init( this.#options );
                this.#init = null;
                this.#options = null;

                this.#cipherInfo = getCipherInfo( res.algorithm );

                if ( !this.#cipherInfo?.isSupported ) {
                    throw new Error( "Cipher is not supported" );
                }

                this.#cipher = crypto.createCipheriv( this.#cipherInfo.algorithm, res.key, res.iv, {
                    "authTagLength": this.#cipherInfo.authTagLength,
                } );

                // wtite header
                if ( res.header ) {
                    this.push( res.header );
                }

                // write auth tag length
                if ( this.#cipherInfo.authTagLength ) {
                    const buffer = Buffer.allocUnsafe( 1 );
                    buffer.writeUInt8( this.#cipherInfo.authTagLength );

                    this.push( buffer );
                }
            }
            catch ( e ) {
                return callback( e );
            }
        }

        try {
            this.push( this.#cipher.update( chunk, encoding ) );

            callback();
        }
        catch ( e ) {
            callback( e );
        }
    }

    _flush ( callback ) {
        try {
            if ( this.#cipher ) {
                this.push( this.#cipher.final() );

                if ( this.#cipherInfo.authTagLength ) {
                    this.push( this.#cipher.getAuthTag() );
                }
            }

            callback();
        }
        catch ( e ) {
            callback( e );
        }
    }
}

export class Decrypt extends stream.Transform {
    #init;
    #options;
    #cipherInfo;
    #buffer;
    #decipher;
    #authTagLength;
    #authTag;
    #complete = true;

    constructor ( { init, ...options } = {} ) {
        super();

        this.#init = init || opensslInit;
        this.#options = options;
    }

    // protected
    async _transform ( chunk, encoding, callback ) {
        this.#complete = false;

        // decode chunk
        if ( !Buffer.isBuffer( chunk ) ) {
            try {
                chunk = Buffer.from( chunk, encoding );
            }
            catch ( e ) {
                return callback( e );
            }
        }

        if ( this.#buffer?.length ) {
            this.#buffer = Buffer.concat( [ this.#buffer, chunk ] );
        }
        else {
            this.#buffer = chunk;
        }

        // init
        if ( this.#init ) {
            try {
                const res = await this.#init( {
                    ...this.#options,
                    "buffer": this.#buffer,
                } );

                // need more data
                if ( !res ) return callback();

                this.#init = null;
                this.#options = null;

                this.#cipherInfo = getCipherInfo( res.algorithm );

                if ( !this.#cipherInfo?.isSupported ) {
                    throw new Error( "Cipher is not supported" );
                }

                if ( res.offset ) {
                    this.#buffer = this.#buffer.subarray( res.offset );
                }

                this.#decipher = crypto.createDecipheriv( this.#cipherInfo.algorithm, res.key, res.iv, {
                    "authTagLength": this.#authTagLength,
                } );
            }
            catch ( e ) {
                return callback( e );
            }
        }

        // need more data
        if ( !this.#buffer.length ) return callback();

        try {

            // read auth tag length
            if ( this.#cipherInfo.authTagLength && !this.#authTagLength ) {
                this.#authTagLength = this.#buffer.readUInt8();
                this.#buffer = this.#buffer.subarray( 1 );

                // need more data
                if ( !this.#buffer.length ) return callback();
            }

            if ( this.#cipherInfo.authTagLength ) {
                this.#authTag ||= Buffer.allocUnsafe( 0 );

                if ( this.#buffer.length >= this.#authTagLength ) {
                    if ( this.#authTag.length ) {
                        this.push( this.#decipher.update( this.#authTag ) );
                    }

                    this.#authTag = this.#buffer.subarray( -this.#authTagLength );
                    this.#buffer = this.#buffer.subarray( 0, -this.#authTagLength );
                }
                else {
                    this.#buffer = Buffer.concat( [ this.#authTag, this.#buffer ] );

                    if ( this.#buffer.length >= this.#authTagLength ) {
                        this.#authTag = this.#buffer.subarray( -this.#authTagLength );
                        this.#buffer = this.#buffer.subarray( 0, -this.#authTagLength );
                    }
                    else {
                        this.#authTag = this.#buffer;
                        this.#buffer = null;
                    }
                }
            }

            if ( this.#buffer.length ) {
                this.push( this.#decipher.update( this.#buffer ) );

                this.#buffer = null;
            }

            callback();
        }
        catch ( e ) {
            callback( e );
        }
    }

    _flush ( callback ) {
        try {
            if ( this.#decipher ) {
                if ( this.#cipherInfo.authTagLength ) {
                    this.#decipher.setAuthTag( this.#authTag );
                }

                this.push( this.#decipher.final() );

                this.#complete = true;
            }

            // data is not complete
            if ( !this.#complete ) {
                throw new Error( "Data is not complete" );
            }

            callback();
        }
        catch ( e ) {
            callback( e );
        }
    }
}

export class Sign extends stream.Transform {
    #sign;
    #privateKey;
    #outputEncoding;

    constructor ( algorithm, privateKey, { outputEncoding } = {} ) {
        super();

        this.#sign = crypto.createSign( algorithm );
        this.#privateKey = privateKey;
        this.#outputEncoding = outputEncoding;
    }

    // protected
    _transform ( chunk, encoding, callback ) {
        this.#sign.update( chunk, encoding );

        callback();
    }

    _flush ( callback ) {
        callback( null, this.#sign.sign( this.#privateKey, this.#outputEncoding ) );

        this.#sign = null;
    }
}

export function getCipherInfo ( algorithm ) {
    var options = CIPHERS[ algorithm.toUpperCase() ];

    if ( !options ) {
        options = {
            ...crypto.getCipherInfo( algorithm ),
            "algorithm": algorithm.toUpperCase(),
            "authTagLength": null,
            "isSupported": true,
        };

        // NOTE: CCM ciphers are currently not supported due to algorithm limitations
        // NOTE: https://nodejs.org/api/crypto.html#ccm-mode
        if ( options.mode === "ccm" ) options.isSupported = false;

        if ( AUTH_TAG_CIPHERS.has( options.mode ) || AUTH_TAG_CIPHERS.has( options.algorithm ) ) {
            options.authTagLength = DEFAULT_AUTH_TAG_LENGTH;
        }

        CIPHERS[ options.algorithm ] = options;
    }

    return options;
}

// private
async function opensslInit ( { buffer, key, algorithm, preset, iterations } = {} ) {
    preset ||= OPENSSL_DEFAULT_PRESET;

    const cipher = getCipherInfo( algorithm || OPENSSL_DEFAULT_ALGORITHM ),
        id = preset + "/" + ( iterations || 0 );

    var passwordHash = PASSWORD_HASH_CACHE.get( id );

    if ( !passwordHash ) {
        passwordHash = new PasswordHash( {
            preset,
            iterations,
        } );

        PASSWORD_HASH_CACHE.set( id, passwordHash );
    }

    // read header
    if ( buffer ) {

        // header is not complete
        if ( buffer.length < 8 + passwordHash.saltLength ) return;

        const salt = buffer.subarray( 8, 8 + passwordHash.saltLength ),
            res = await deriveOpensslKey( key, { passwordHash, salt, cipher } );

        if ( !res.ok ) throw res;

        return {
            "algorithm": cipher.algorithm,
            "key": res.data.key,
            "iv": res.data.iv,
            "offset": 8 + passwordHash.saltLength,
        };
    }

    // create header
    else {
        const res = await deriveOpensslKey( key, { passwordHash, cipher } );
        if ( !res.ok ) throw res;

        return {
            "algorithm": cipher.algorithm,
            "key": res.data.key,
            "iv": res.data.iv,
            "header": Buffer.concat( [ OPENSSL_SALT_BUFFER, res.data.salt ] ),
        };
    }
}

async function deriveOpensslKey ( key, { passwordHash, salt, cipher } = {} ) {

    // derive key
    const res = await passwordHash.createPasswordHash( key, {
        "phc": false,
        salt,
        "hashLength": cipher.keyLength + cipher.ivLength,
    } );

    if ( !res.ok ) return res;

    return result( 200, {
        "key": res.data.hash.subarray( 0, cipher.keyLength ),
        "iv": res.data.hash.subarray( cipher.keyLength, cipher.keyLength + cipher.ivLength ),
        "salt": res.data.salt,
    } );
}
