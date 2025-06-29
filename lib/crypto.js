import "#lib/result";
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import stream from "node:stream";
import fetch from "#lib/fetch";
import msgpack from "#lib/msgpack";
import * as Base64Stream from "#lib/stream/base64";
import * as HexStream from "#lib/stream/hex";
import { TmpFile } from "#lib/tmp";

const OPENSSL_DEFAULT_SALT_LENGTH = 16,
    OPENSSL_DEFAULT_DIGEST = "SHA3-512",
    OPENSSL_DEFAULT_ITERATIONS = 10_000,
    OPENSSL_DIGEST_ITERATIONS = {
        "SHA3-512": 210_000,
        "SHA256": 600_000,
    },
    OPENSSL_SALT_BUFFER = Buffer.from( "Salted__" + "\0".repeat( 16 ) ),
    SSH_SECRETS = new Map();

// public
export async function encrypt ( key, data, { inputEncoding, outputEncoding, openssl } = {} ) {
    if ( data == null ) return null;

    if ( typeof key === "function" ) {
        key = await key();
    }

    var cipher, header, iv, keyId;

    if ( openssl ) {
        if ( openssl === true ) openssl = {};

        const res = await deriveOpensslKey( key, openssl );
        if ( !res ) throw res;

        let salt;

        ( { key, iv, salt } = res.data );

        cipher = crypto.createCipheriv( "aes-256-cbc", key, iv );

        salt.copy( OPENSSL_SALT_BUFFER, 8 );

        header = OPENSSL_SALT_BUFFER.subarray( 0, 8 + salt.length );
    }
    else {
        if ( key.key ) {
            keyId = key.id;
            key = key.key;
        }

        keyId ??= null;

        iv = await new Promise( ( resolve, reject ) => {
            crypto.randomBytes( 16, ( e, buffer ) => {
                if ( e ) {
                    reject( e );
                }
                else {
                    resolve( buffer );
                }
            } );
        } );

        // stream
        if ( data instanceof stream.Readable ) {
            cipher = crypto.createCipheriv( "aes-256-cbc", key, iv );

            header = msgpack.encode( [ "aes-256-cbc", keyId, iv ] );
        }

        // buffer
        else {
            cipher = crypto.createCipheriv( "aes-256-gcm", key, iv );
        }
    }

    // stream
    if ( data instanceof stream.Readable ) {
        let headerPushed;

        const transformStream = new stream.Transform( {
            transform ( chunk, encoding, callback ) {
                if ( !headerPushed ) {
                    headerPushed = true;

                    this.push( header );
                }

                callback( null, cipher.update( chunk, encoding ) );
            },

            flush ( callback ) {
                this.push( cipher.final() );

                callback();
            },
        } );

        const streams = [ data ];

        if ( inputEncoding ) {
            if ( inputEncoding === "base64" ) {
                streams.push( new Base64Stream.Decode() );
            }
            else if ( inputEncoding === "base64url" ) {
                streams.push( new Base64Stream.Decode( { "base64url": true } ) );
            }
            else if ( inputEncoding === "hex" ) {
                streams.push( new HexStream.Decode() );
            }
        }

        streams.push( transformStream );

        if ( outputEncoding ) {
            if ( outputEncoding === "base64" ) {
                streams.push( new Base64Stream.Encode() );
            }
            else if ( outputEncoding === "base64url" ) {
                streams.push( new Base64Stream.Encode( { "base64url": true } ) );
            }
            else if ( outputEncoding === "hex" ) {
                streams.push( new HexStream.Encode() );
            }
        }

        return stream.pipeline( ...streams, () => {} );
    }

    // buffer
    else {
        const buf1 = cipher.update( data, inputEncoding ),
            buf2 = cipher.final();

        if ( !header ) {
            header = msgpack.encode( [ "aes-256-gcm", keyId, iv, cipher.getAuthTag() ] );
        }

        const buffer = Buffer.concat( [ header, buf1, buf2 ] );

        if ( outputEncoding ) {
            return buffer.toString( outputEncoding );
        }
        else {
            return buffer;
        }
    }
}

export async function decrypt ( key, data, { inputEncoding, outputEncoding, openssl } = {} ) {
    if ( data == null ) return null;

    if ( openssl === true ) openssl = {};

    // stream
    if ( data instanceof stream.Readable ) {
        let buffer, decipher;

        const transformStream = new stream.Transform( {
            async transform ( chunk, encoding, callback ) {
                try {
                    if ( !decipher ) {

                        // decode chunk
                        if ( typeof chunk === "string" ) {
                            chunk = Buffer.from( chunk, encoding );
                        }

                        // concat buffer
                        if ( buffer ) {
                            buffer = Buffer.concat( buffer, chunk );
                        }
                        else {
                            buffer = chunk;
                        }

                        if ( openssl ) {
                            const saltLength = openssl.saltLength || OPENSSL_DEFAULT_SALT_LENGTH,
                                offset = 8 + saltLength * 2;

                            // openssl header is not complete
                            if ( buffer.lingth < offset ) {
                                callback();
                            }

                            // openssl header is complete
                            else {
                                const salt = buffer.subarray( 8, offset );

                                const res = await deriveOpensslKey( key, { ...openssl, salt } );

                                if ( res.ok ) {
                                    decipher = crypto.createDecipheriv( "aes-256-cbc", res.data.key, res.data.iv );

                                    callback( null, decipher.update( buffer.subarray( offset ) ) );
                                }
                                else {
                                    callback( res );
                                }
                            }
                        }
                        else {

                            // try to decode header
                            const { "value": [ algorithm, keyId, iv, authTag ] = [], offset } = msgpack.decodeStream( buffer ) || {};

                            // header is not complete
                            if ( offset == null ) {
                                callback();
                            }

                            // header is complete
                            else {
                                if ( typeof key === "function" ) {
                                    key = await key( keyId );
                                }

                                if ( key.key ) key = key.key;

                                decipher = crypto.createDecipheriv( algorithm, key, iv );

                                if ( authTag ) {
                                    decipher.setAuthTag( authTag );
                                }

                                callback( null, decipher.update( buffer.subarray( offset ) ) );
                            }
                        }
                    }
                    else {
                        callback( null, decipher.update( chunk, encoding ) );
                    }
                }
                catch ( e ) {
                    callback( e );
                }
            },

            flush ( callback ) {
                this.push( decipher.final() );

                callback();
            },
        } );

        const streams = [ data ];

        if ( inputEncoding ) {
            if ( inputEncoding === "base64" ) {
                streams.push( new Base64Stream.Decode() );
            }
            else if ( inputEncoding === "base64url" ) {
                streams.push( new Base64Stream.Decode( { "base64url": true } ) );
            }
            else if ( inputEncoding === "hex" ) {
                streams.push( new HexStream.Decode() );
            }
        }

        streams.push( transformStream );

        if ( outputEncoding ) {
            if ( outputEncoding === "base64" ) {
                streams.push( new Base64Stream.Encode() );
            }
            else if ( outputEncoding === "base64url" ) {
                streams.push( new Base64Stream.Encode( { "base64url": true } ) );
            }
            else if ( outputEncoding === "hex" ) {
                streams.push( new HexStream.Encode() );
            }
        }

        return stream.pipeline( ...streams, () => {} );
    }

    // buffer
    else {
        if ( typeof data === "string" ) {
            data = Buffer.from( data, inputEncoding );
        }

        let decipher, offset;

        if ( openssl ) {
            const saltLength = openssl.saltLength || OPENSSL_DEFAULT_SALT_LENGTH;

            offset = 8 + saltLength;

            const salt = data.subarray( 8, offset );

            const res = await deriveOpensslKey( key, { ...openssl, salt } );
            if ( !res.ok ) throw res;

            decipher = crypto.createDecipheriv( "aes-256-cbc", res.data.key, res.data.iv );
        }
        else {
            const header = msgpack.decodeStream( data );

            offset = header.offset;

            const [ algorithm, keyId, iv, authTag ] = header.value;

            if ( typeof key === "function" ) {
                key = await key( keyId );
            }

            if ( key.key ) key = key.key;

            decipher = crypto.createDecipheriv( algorithm, key, iv );

            if ( authTag ) {
                decipher.setAuthTag( authTag );
            }
        }

        const buffer = Buffer.concat( [

            //
            decipher.update( data.subarray( offset ) ),
            decipher.final(),
        ] );

        if ( outputEncoding ) {
            return buffer.toString( outputEncoding );
        }
        else {
            return buffer;
        }
    }
}

export async function encryptSsh ( gitHubUsername, data, { inputEncoding, outputEncoding, cache, ...openssl } = {} ) {
    var res;

    res = await getSshSecret( gitHubUsername, { cache } );
    if ( !res.ok ) throw res;
    const secret = res.data;

    return encrypt( secret, data, {
        inputEncoding,
        outputEncoding,
        "openssl": {
            "digest": "SHA256",
            "iterations": OPENSSL_DEFAULT_ITERATIONS,
            "saltLength": 8,
            ...openssl,
        },
    } );
}

export async function decryptSsh ( gitHubUsername, data, { inputEncoding, outputEncoding, cache, ...openssl } = {} ) {
    var res;

    res = await getSshSecret( gitHubUsername, { cache } );
    if ( !res.ok ) throw res;
    const secret = res.data;

    return decrypt( secret, data, {
        inputEncoding,
        outputEncoding,
        "openssl": {
            "digest": "SHA256",
            "iterations": OPENSSL_DEFAULT_ITERATIONS,
            "saltLength": 8,
            ...openssl,
        },
    } );
}

// private
async function getSshSecret ( gitHubUsername, { cache } = {} ) {
    if ( !cache ) {
        SSH_SECRETS.delete( gitHubUsername );
    }
    else if ( SSH_SECRETS.has( gitHubUsername ) ) {
        return result( 200, SSH_SECRETS.get( gitHubUsername ) );
    }

    var res;

    res = await fetch( `https://github.com/${ gitHubUsername }.keys` );
    if ( !res.ok ) return res;

    const sshPublicKeys = await res.text();

    if ( !sshPublicKeys ) {
        return result( [ 500, "SSH public keys not found on GitHub" ] );
    }

    const tmpFile = new TmpFile();

    await fs.promises.writeFile( tmpFile.path, sshPublicKeys );

    return new Promise( resolve => {
        const proc = childProcess.spawn(
            "ssh-keygen",
            [

                //
                "-Y",
                "sign",
                "-n",
                "ssh-crypt",
                "-q",
                "-f",
                tmpFile.path,
            ],
            {
                "encoding": "buffer",
                "stdio": [ "pipe", "pipe", "pipe" ],
            }
        );

        const stdout = [],
            stderr = [];

        proc.once( "error", e => resolve( result( [ 500, e.message ] ) ) );

        proc.stdout.on( "data", data => stdout.push( data ) );

        proc.stderr.on( "data", data => stderr.push( data ) );

        proc.once( "close", code => {
            var res;

            if ( code ) {
                res = result( [ 500, Buffer.concat( stderr ).toString() ] );
            }
            else {
                const secret = crypto.createHash( "SHA3-256" ).update( Buffer.concat( stdout ) ).digest( "buffer" );

                SSH_SECRETS.set( gitHubUsername, secret );

                res = result( 200, secret );
            }

            resolve( res );
        } );

        proc.stdin.write( gitHubUsername );
        proc.stdin.end();
    } );
}

async function deriveOpensslKey ( key, { digest, iterations, salt, saltLength } = {} ) {
    if ( typeof key === "string" ) key = Buffer.from( key );

    digest ||= OPENSSL_DEFAULT_DIGEST;

    iterations ||= OPENSSL_DIGEST_ITERATIONS[ digest ] || OPENSSL_DEFAULT_ITERATIONS;

    salt ||= await new Promise( ( resolve, reject ) => {
        crypto.randomBytes( saltLength || OPENSSL_DEFAULT_SALT_LENGTH, ( e, buffer ) => {
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
            Buffer.from( key ),
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
