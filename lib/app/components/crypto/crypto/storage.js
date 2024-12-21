import crypto from "node:crypto";
import stream from "node:stream";
import msgpack from "#lib/msgpack";

const MASTER_KEY_ID = -1;

export class CryptoStorage {
    #crypto;
    #key;
    #keys;

    constructor ( crypto, key ) {
        this.#crypto = crypto;
        this.#key = key;
    }

    // properties
    get app () {
        return this.#crypto.app;
    }

    // public
    async init () {

        // create master key
        this.#key = {
            "id": MASTER_KEY_ID,
            "key": crypto.createSecretKey( this.#key, "base64url" ),
        };

        if ( this.#key.symmetricKeyType !== "secret" || this.#key.symmetricKeySize !== 32 ) {
            return result( [ 400, `AES key 256 bits length is required` ] );
        }

        var res;

        // init
        res = await this._init();
        if ( !res ) return res;

        // load keys
        res = await this.loadKeys();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // XXX
    async loadKeys () {
        var res;

        res = await this._loadKeys();
        if ( !res.ok ) return res;

        this.#keys = {};

        if ( res.data ) {
            for ( const key of res.data ) {
                key.key = crypto.createSecretKey( this.#crypto.decrypt( key.key, {
                    "inputEncoding": "base64url",
                } ) );
            }
        }

        return result( 200 );
    }

    encrypt ( data, { key, inputEncoding, outputEncoding } = {} ) {
        if ( data == null ) return null;

        key ||= this.#getDefaultSymmetricKey();

        // stream
        if ( data instanceof stream.Readable ) {
            const iv = crypto.randomBytes( 16 ),
                cipher = crypto.createCipheriv( "aes-256-cbc", key.key, iv );

            let headerPushed;

            const transformStream = new stream.Transform( {
                transform ( chunk, encoding, callback ) {
                    if ( !headerPushed ) {
                        headerPushed = true;

                        const header = msgpack.encode( [

                            //
                            "aes-256-cbc",
                            key.id,
                            iv,
                        ] );

                        this.push( header );
                    }

                    callback( null, cipher.update( chunk, encoding ) );
                },

                flush ( callback ) {
                    this.push( cipher.final() );

                    callback();
                },
            } );

            return data.pipe( transformStream );
        }

        // buffer
        else {
            const iv = crypto.randomBytes( 12 ),
                cipher = crypto.createCipheriv( "aes-256-gcm", key.key, iv ),
                buf1 = cipher.update( data, inputEncoding ),
                buf2 = cipher.final(),
                header = msgpack.encode( [

                    //
                    "aes-256-gcm",
                    key.id,
                    iv,
                    cipher.getAuthTag(),
                ] );

            const buffer = Buffer.concat( [

                //
                header,
                buf1,
                buf2,
            ] );

            if ( outputEncoding ) {
                return buffer.toString( outputEncoding );
            }
            else {
                return buffer;
            }
        }
    }

    decrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        if ( data == null ) return null;

        // stream
        if ( data instanceof stream.Readable ) {
            let buffer, decipher;

            const transformStream = new stream.Transform( {
                transform ( chunk, encoding, callback ) {
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

                            const decoded = msgpack.decodeStream( buffer );

                            // header is not complete
                            if ( !decoded ) {
                                callback();
                            }

                            // header is decoded
                            else {
                                const [ [ algorithm, keyId, iv, authTag ], offset ] = decoded,
                                    key = this.#getSymmetricKey( keyId );

                                decipher = crypto.createDecipheriv( algorithm, key.key, iv );

                                if ( authTag ) {
                                    decipher.setAuthTag( authTag );
                                }

                                callback( null, decipher.update( buffer.subarray( offset ) ) );
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

            return data.pipe( transformStream );
        }

        // buffer
        else {
            if ( typeof data === "string" ) {
                data = Buffer.from( data, inputEncoding );
            }

            const [ [ algorithm, keyId, iv, authTag ], offset ] = msgpack.decodeStream( data ),
                key = this.#getSymmetricKey( keyId );

            const decipher = crypto.createDecipheriv( algorithm, key.key, iv );

            if ( authTag ) {
                decipher.setAuthTag( authTag );
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

    wrapKey ( key ) {
        key = key.export( {
            "format": "buffer",
        } );

        return this.encrypt( key, {
            "key": this.#key,
            "outputEncoding": "base64url",
        } );
    }

    // XXX
    async createDefaultSymmetricKey () {
        const key = await new Promise( resolve => {
            crypto.generateKey(
                "aes",
                {
                    "length": 256,
                },
                ( e, key ) => resolve( key )
            );
        } );

        return key;
    }

    // private
    // XXX
    #getDefaultSymmetricKey () {}

    #getSymmetricKey ( id ) {
        if ( id === MASTER_KEY_ID ) {
            return this.#key.key;
        }
        else {
            return this.#keys[ id ]?.key;
        }
    }
}
