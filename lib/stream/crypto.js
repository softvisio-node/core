import crypto from "node:crypto";
import stream from "#lib/stream";

const OPENSSL_DEFAULT_PRESET = "modern",
    OPENSSL_PRESETS = {
        "default": {
            "algorithm": "AES-256-CBC",
            "saltLength": 8,
            "digest": "SHA256",
            "iterations": 10_000,
        },
        "modern": {
            "algorithm": "AES-256-CBC",
            "saltLength": 16,
            "digest": "SHA3-512",
            "iterations": 600_000,
            "digestIterations": {
                "SHA3-512": 210_000,
                "SHA256": 600_000,
            },
        },
    },
    OPENSSL_SALT_BUFFER = Buffer.from( "Salted__" ),
    DEFAULT_KEY_LENGTH = 32,
    DEFAULT_IV_LENGTH = 16,
    DEFAULT_AUTH_TAG_LENGTH = 16,
    MIN_ENCRYPTED_CHUNK_LENGTH = 250_000,
    CIPHERS = {
        "CHACHA20-POLY1305": {
            "algorithm": "CHACHA20-POLY1305",
            "keyLength": 32,
            "ivLength": 12,
            "authTagLength": DEFAULT_AUTH_TAG_LENGTH,
            "cunked": false,
            "isSupported": true,
        },
    };

for ( const algorithm of crypto.getCiphers() ) {
    const cipher = {
        "algorithm": algorithm.toUpperCase(),
        "keyLength": DEFAULT_KEY_LENGTH,
        "ivLength": DEFAULT_IV_LENGTH,
        "authTagLength": null,
        "chunked": false,
        "isSupported": true,
    };

    CIPHERS[ cipher.algorithm ] = cipher;

    if ( cipher.algorithm.endsWith( "-GCM" ) ) {
        cipher.ivLength = 12;
        cipher.authTagLength = DEFAULT_AUTH_TAG_LENGTH;
        cipher.chunked = false;
    }
    else if ( cipher.algorithm.endsWith( "-OCB" ) ) {
        cipher.ivLength = 15;
        cipher.authTagLength = DEFAULT_AUTH_TAG_LENGTH;
        cipher.chunked = false;
    }

    // FIXME: CCM ciphers are currently not supported due to algorithm limitations
    // NOTE: https://nodejs.org/api/crypto.html#ccm-mode
    else if ( cipher.algorithm.endsWith( "-CCM" ) ) {
        cipher.isSupported = false;
        cipher.ivLength = 13;
        cipher.authTagLength = 16;
        cipher.chunked = true;
    }

    // define key length
    if ( cipher.algorithm.startsWith( "AES-128-" ) ) {
        cipher.keyLength = 16;
    }
    else if ( cipher.algorithm.startsWith( "AES-192-" ) ) {
        cipher.keyLength = 24;
    }
    else if ( cipher.algorithm.startsWith( "AES-256-" ) ) {
        cipher.keyLength = 32;
    }
}

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

export class Encrypt extends stream.Transform {
    #init;
    #options;
    #cipherOptions;
    #key;
    #iv;
    #minEncryptedChunkLength;
    #cipher;
    #chunks = [];
    #chunksLength = 0;

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

                this.#cipherOptions = getCipherOptions( res.algorithm );
                this.#key = res.key;
                this.#iv = res.iv;
                this.#minEncryptedChunkLength = res.minEncryptedChunkLength || MIN_ENCRYPTED_CHUNK_LENGTH;

                if ( !this.#cipherOptions.isSupported ) {
                    throw new Error( `Cipher is not supported` );
                }

                const header = res.header;

                if ( header ) {
                    this.push( header );

                    // write auth tag length
                    if ( this.#cipherOptions.authTagLength ) {
                        const authTagLengthBuffer = Buffer.allocUnsafe( 1 );
                        authTagLengthBuffer.writeUInt8( this.#cipherOptions.authTagLength );

                        this.push( authTagLengthBuffer );
                    }
                }
            }
            catch ( e ) {
                return callback( e );
            }
        }

        try {
            this.#cipher ||= crypto.createCipheriv( this.#cipherOptions.algorithm, this.#key, this.#iv, {
                "authTagLength": this.#cipherOptions.authTagLength,
            } );

            const buffer = this.#cipher.update( chunk, encoding );

            // auth tag, chunked
            if ( this.#cipherOptions.chunked ) {
                this.#writeChunk( buffer );
            }

            // not chunked
            else {
                this.push( buffer );
            }

            callback();
        }
        catch ( e ) {
            callback( e );
        }
    }

    _flush ( callback ) {
        try {
            if ( this.#cipher ) {

                // auth tag, chunked
                if ( this.#cipherOptions.chunked ) {
                    this.#writeChunk();
                }
                else {
                    this.push( this.#cipher.final() );

                    if ( this.#cipherOptions.authTagLength ) {
                        this.push( this.#cipher.getAuthTag() );
                    }
                }
            }

            callback();
        }
        catch ( e ) {
            callback( e );
        }
    }

    // private
    #writeChunk ( buffer ) {
        this.#addChunk( buffer );

        if ( !buffer || this.#chunksLength >= this.#minEncryptedChunkLength ) {
            this.#addChunk( this.#cipher.final() );

            if ( this.#chunksLength ) {
                const authTag = this.#cipher.getAuthTag(),
                    chunkHeader = Buffer.allocUnsafe( authTag.length + 4 );

                authTag.copy( chunkHeader );
                chunkHeader.writeUInt32BE( this.#chunksLength, authTag.length );

                this.push( chunkHeader );

                for ( const buffer of this.#chunks ) {
                    this.push( buffer );
                }
            }

            this.#cipher = null;
            this.#chunks = [];
            this.#chunksLength = 0;
        }
    }

    #addChunk ( buffer ) {
        if ( !buffer?.length ) return;

        this.#chunks.push( buffer );

        this.#chunksLength += buffer.length;
    }
}

export class Decrypt extends stream.Transform {
    #init;
    #options;
    #cipherOptions;
    #key;
    #iv;
    #buffer;
    #decipher;
    #authTagLength;
    #authTag;
    #chunkLength = 0;
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

        if ( this.#buffer ) {
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

                if ( res.offset ) {
                    this.#buffer = this.#buffer.subarray( res.offset );
                }

                this.#cipherOptions = getCipherOptions( res.algorithm );
                this.#key = res.key;
                this.#iv = res.iv;

                if ( !this.#cipherOptions.isSupported ) {
                    throw new Error( `Cipher is not supported` );
                }
            }
            catch ( e ) {
                return callback( e );
            }
        }

        // need more data
        if ( !this.#buffer.length ) return callback();

        try {

            // read auth tag length
            if ( this.#cipherOptions.authTagLength && !this.#authTagLength ) {
                this.#authTagLength = this.#buffer.readUInt8();
                this.#buffer = this.#buffer.subarray( 1 );

                // need more data
                if ( !this.#buffer.length ) {
                    this.#buffer = null;
                    return callback();
                }
            }

            // auth tag, chunked
            if ( this.#cipherOptions.chunked ) {
                this.#readChunk();
            }
            else {
                this.#decipher ||= crypto.createDecipheriv( this.#cipherOptions.algorithm, this.#key, this.#iv, {
                    "authTagLength": this.#authTagLength,
                } );

                // auth tag, not chunked
                if ( this.#cipherOptions.authTagLength ) {
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

                if ( this.#buffer?.length ) {
                    this.push( this.#decipher.update( this.#buffer ) );
                }

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

                // auth tag, chunked
                if ( this.#cipherOptions.chunked ) {
                    this.#readChunk();
                }
                else {

                    // auth tag, not chunked
                    if ( this.#cipherOptions.authTagLength ) {
                        this.#decipher.setAuthTag( this.#authTag );
                    }

                    this.push( this.#decipher.final() );

                    this.#complete = true;
                }
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

    // private
    #readChunk () {
        if ( !this.#buffer?.length ) return;

        // read chunk header
        if ( !this.#decipher ) {

            // chunk started
            this.#complete = false;

            const chunkHeaderLength = this.#authTagLength + 4;

            // chunk header is incomplete
            if ( this.#buffer.length < chunkHeaderLength ) return;

            this.#chunkLength = this.#buffer.readUInt32BE( this.#authTagLength );

            this.#decipher = crypto.createDecipheriv( this.#cipherOptions.algorithm, this.#key, this.#iv, {
                "authTagLength": this.#authTagLength,
            } );

            this.#decipher.setAuthTag( this.#buffer.subarray( 0, this.#authTagLength ) );

            this.#buffer = this.#buffer.subarray( chunkHeaderLength );
        }

        if ( !this.#buffer.length ) return;

        // chunk is not complete
        if ( this.#buffer.length < this.#chunkLength ) {
            this.push( this.#decipher.update( this.#buffer ) );

            this.#chunkLength -= this.#buffer.length;
            this.#buffer = Buffer.allocUnsafe( 0 );
        }

        // chunk complete
        else {
            const buffer = this.#decipher.update( this.#buffer.subarray( 0, this.#chunkLength ) );

            this.#buffer = this.#buffer.subarray( this.#chunkLength );

            this.push( buffer );
            this.push( this.#decipher.final() );

            this.#decipher = null;
            this.#chunkLength = 0;
            this.#complete = true;

            this.#readChunk();
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

export function getCipherOptions ( algorithm ) {
    return CIPHERS[ algorithm.toUpperCase() ];
}

// private
async function opensslInit ( { buffer, key, preset, algorithm, digest, iterations, saltLength } = {} ) {
    preset = OPENSSL_PRESETS[ preset ] || OPENSSL_PRESETS[ OPENSSL_DEFAULT_PRESET ];

    const cipher = getCipherOptions( algorithm || preset.algorithm );

    // read header
    if ( buffer ) {
        saltLength ||= preset.saltLength;

        // header is not complete
        if ( buffer.length < 8 + saltLength ) return;

        const salt = buffer.subarray( 8, 8 + saltLength ),
            res = await deriveOpensslKey( key, { preset, digest, iterations, salt, cipher } );

        if ( !res.ok ) throw res;

        return {
            "algorithm": cipher.algorithm,
            "key": res.data.key,
            "iv": res.data.iv,
            "offset": 8 + saltLength,
        };
    }

    // create header
    else {
        const res = await deriveOpensslKey( key, { preset, digest, iterations, saltLength, cipher } );
        if ( !res.ok ) throw res;

        return {
            "algorithm": cipher.algorithm,
            "key": res.data.key,
            "iv": res.data.iv,
            "header": Buffer.concat( [ OPENSSL_SALT_BUFFER, res.data.salt ] ),
        };
    }
}

async function deriveOpensslKey ( key, { preset, digest, iterations, salt, saltLength, cipher } = {} ) {
    if ( typeof key === "string" ) key = Buffer.from( key );

    digest ||= preset.digest;

    iterations ||= preset.digestIterations?.[ digest.toUpperCase() ] || preset.iterations;

    // generate salt
    salt ||= await new Promise( ( resolve, reject ) => {
        crypto.randomBytes( saltLength || preset.saltLength, ( e, buffer ) => {
            if ( e ) {
                reject( e );
            }
            else {
                resolve( buffer );
            }
        } );
    } );

    // derive key
    return new Promise( resolve => {
        crypto.pbkdf2( key, salt, iterations, cipher.keyLength + cipher.ivLength, digest, ( e, derivedKey ) => {
            if ( e ) {
                resolve( result.catch( e ) );
            }
            else {
                resolve( result( 200, {
                    "key": derivedKey.subarray( 0, cipher.keyLength ),
                    "iv": derivedKey.subarray( cipher.keyLength, cipher.keyLength + cipher.ivLength ),
                    salt,
                } ) );
            }
        } );
    } );
}
