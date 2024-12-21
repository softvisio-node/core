import crypto from "node:crypto";
import stream from "node:stream";
import msgpack from "#lib/msgpack";

const MASTER_KEY_ID = -1;

export default class CryptoStorage {
    #crypto;
    #masterKey;
    #keys;
    #activeKeys;

    constructor ( crypto, masterKey ) {
        this.#crypto = crypto;
        this.#masterKey = masterKey;
    }

    // properties
    get app () {
        return this.#crypto.app;
    }

    // public
    async init () {

        // create master key
        this.#masterKey = {
            "id": MASTER_KEY_ID,
            "key": crypto.createSecretKey( this.#masterKey, "base64url" ),
        };

        if ( this.#masterKey.key.type !== "secret" || this.#masterKey.key.symmetricKeySize !== 32 ) {
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

    async loadKeys () {
        var res;

        res = await this._loadKeys();
        if ( !res.ok ) return res;

        this.#keys = {};
        this.#activeKeys = {};

        const keys = res.data || [];

        for ( const key of keys ) {
            this.#keys[ key.id ] = key;

            key.key = crypto.createSecretKey( this.decrypt( key.key, {
                "inputEncoding": "base64url",
            } ) );

            if ( key.active ) {
                this.#activeKeys[ key.type ] = key;
            }
        }

        // add AES key
        if ( !this.#activeKeys.aes ) {
            res = await this._addKey( "aes" );
            if ( !res.ok ) return res;

            return this.loadKeys();
        }

        return result( 200 );
    }

    encrypt ( data, { key, inputEncoding, outputEncoding } = {} ) {
        if ( data == null ) return null;

        key ||= this.#activeKeys.aes;

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
                                    key = this.#getKey( keyId );

                                decipher = crypto.createDecipheriv( algorithm, key, iv );

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
                key = this.#getKey( keyId ),
                decipher = crypto.createDecipheriv( algorithm, key, iv );

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

    // protected
    async _generateKey ( type ) {
        var key;

        if ( type === "aes" ) {
            key = await new Promise( resolve => {
                crypto.generateKey(
                    "aes",
                    {
                        "length": 256,
                    },
                    ( e, key ) => resolve( key )
                );
            } );
        }
        else {
            return result( [ 400, "Invalid key type" ] );
        }

        return result( 200, {
            "id": null,
            type,
            "created": new Date(),
            "active": false,
            key,
        } );
    }

    _wrapKey ( key ) {
        key = key.key.export( {
            "format": "buffer",
        } );

        return this.encrypt( key, {
            "key": this.#masterKey,
            "outputEncoding": "base64url",
        } );
    }

    // private
    #getKey ( id ) {
        if ( id === MASTER_KEY_ID ) {
            return this.#masterKey.key;
        }
        else {
            return this.#keys[ id ]?.key;
        }
    }
}
