import crypto from "node:crypto";
import stream from "#lib/stream";

const MIN_ENCRYPTED_CHUNK_LENGTH = 250_000,
    AUTH_TAG_CIPHERS = new Set( [ "CHACHA20-POLY1305" ] );

for ( const cipher of crypto.getCiphers() ) {
    if ( /-(?:gcm|ccm|ocb)$/.test( cipher ) ) {
        AUTH_TAG_CIPHERS.add( cipher.toUpperCase() );
    }
}

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
    OPENSSL_SALT_BUFFER = Buffer.from( "Salted__" );

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
        callback( this.#hash.digest( this.#outputEncoding ) );

        this.#hash = null;
    }
}

export class Encrypt extends stream.Transform {
    #init;
    #options;
    #algorithm;
    #key;
    #iv;
    #minEncryptedChunkLength;
    #useAuthTag;
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

                this.#algorithm = res.algorithm;
                this.#key = res.key;
                this.#iv = res.iv;
                this.#minEncryptedChunkLength = res.minEncryptedChunkLength || MIN_ENCRYPTED_CHUNK_LENGTH;
                this.#useAuthTag = AUTH_TAG_CIPHERS.has( this.#algorithm.toUpperCase() );

                const header = res.header;

                if ( header ) {
                    this.push( header );
                }
            }
            catch ( e ) {
                return callback( e );
            }
        }

        try {
            this.#cipher ||= crypto.createCipheriv( this.#algorithm, this.#key, this.#iv );

            const buffer = this.#cipher.update( chunk, encoding );

            if ( this.#useAuthTag ) {
                this.#writeChunk( buffer );
            }
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
                if ( this.#useAuthTag ) {
                    this.#writeChunk();
                }
                else {
                    const final = this.#cipher.final();

                    this.push( final );
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
                    chunkHeader = Buffer.allocUnsafe( 2 + authTag.length + 4 );

                chunkHeader.writeUInt16BE( authTag.length, 0 );
                authTag.copy( chunkHeader, 2 );
                chunkHeader.writeUInt32BE( this.#chunksLength, 2 + authTag.length );

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
    #algorithm;
    #key;
    #iv;
    #useAuthTag;
    #buffer;
    #decipher;
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

                this.#algorithm = res.algorithm;
                this.#key = res.key;
                this.#iv = res.iv;
                this.#useAuthTag = AUTH_TAG_CIPHERS.has( this.#algorithm.toUpperCase() );
            }
            catch ( e ) {
                return callback( e );
            }
        }

        // need more data
        if ( !this.#buffer.length ) return callback();

        try {
            if ( this.#useAuthTag ) {
                this.#readChunk();
            }
            else {
                this.#decipher ||= crypto.createDecipheriv( this.#algorithm, this.#key, this.#iv );

                const buffer = this.#decipher.update( this.#buffer );
                this.#buffer = null;

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
            if ( this.#decipher ) {
                if ( this.#useAuthTag ) {
                    this.#readChunk();
                }
                else {
                    const final = this.#decipher.final();

                    this.push( final );

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

            if ( this.#buffer.length < 2 ) return;

            const authTagLength = this.#buffer.readUInt16BE(),
                chunkHeaderLength = 2 + authTagLength + 4;

            // chunk header is incomplete
            if ( this.#buffer.length < chunkHeaderLength ) return;

            this.#chunkLength = this.#buffer.readUInt32BE( 2 + authTagLength );

            this.#decipher = crypto.createDecipheriv( this.#algorithm, this.#key, this.#iv );
            this.#decipher.setAuthTag( this.#buffer.subarray( 2, 2 + authTagLength ) );

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

// private
async function opensslInit ( { buffer, key, preset, algorithm, digest, iterations, saltLength } = {} ) {
    preset = OPENSSL_PRESETS[ preset ] || OPENSSL_PRESETS[ OPENSSL_DEFAULT_PRESET ];

    // read header
    if ( buffer ) {
        saltLength ||= preset.saltLength;

        // header is not complete
        if ( buffer.length < 8 + saltLength ) return;

        const salt = buffer.subarray( 8, 8 + saltLength ),
            res = await deriveOpensslKey( key, { preset, digest, iterations, salt } );

        if ( !res.ok ) throw res;

        return {
            "algorithm": algorithm || preset.algorithm,
            "key": res.data.key,
            "iv": res.data.iv,
            "offset": 8 + saltLength,
        };
    }

    // create header
    else {
        const res = await deriveOpensslKey( key, { preset, digest, iterations, saltLength } );
        if ( !res.ok ) throw res;

        return {
            "algorithm": algorithm || preset.algorithm,
            "key": res.data.key,
            "iv": res.data.iv,
            "header": Buffer.concat( [ OPENSSL_SALT_BUFFER, res.data.salt ] ),
        };
    }
}

async function deriveOpensslKey ( key, { preset, digest, iterations, salt, saltLength } = {} ) {
    if ( typeof key === "string" ) key = Buffer.from( key );

    digest ||= preset.digest;

    iterations ||= preset.digestIterations?.[ digest.toUpperCase() ] || preset.iterations;

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

    return new Promise( resolve => {
        crypto.pbkdf2(
            key,
            salt,
            iterations, // openssl default: 10_000
            48,
            digest,
            ( e, derivedKey ) => {
                if ( e ) {
                    resolve( result.catch( e ) );
                }
                else {
                    resolve( result( 200, {
                        "key": derivedKey.subarray( 0, 32 ),
                        "iv": derivedKey.subarray( 32 ),
                        salt,
                    } ) );
                }
            }
        );
    } );
}
