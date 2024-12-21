import crypto from "node:crypto";
import stream from "node:stream";
import msgpack from "#lib/msgpack";
import LocalCryptoStorage from "./crypto/storage/local.js";
import RemoteCryptoStorage from "./crypto/storage/remote.js";

export default class Env {
    #app;
    #config;
    #storage;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    // public
    async init () {

        // create storage
        if ( this.app.dbh ) {
            this.#storage = new RemoteCryptoStorage( this, this.#config.key );
        }
        else {
            this.#storage = new LocalCryptoStorage( this, this.#config.key );
        }

        var res;

        // init storage
        res = await this.#storage.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    encrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return this.#encrypt( data, { inputEncoding, outputEncoding } );
    }

    decrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return this.#decrypt( data, { inputEncoding, outputEncoding } );
    }

    wrapKey ( key ) {
        return this.#encrypt( key, {
            "key": this.#storage.getMasterKey(),
            "inputEncoding": null,
            "outputEncoding": "base64url",
        } );
    }

    // private
    #encrypt ( data, { key, inputEncoding, outputEncoding } = {} ) {
        if ( data == null ) return null;

        key ||= this.#storage.getDefaultSymmetricKey();

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

    #decrypt ( data, { inputEncoding, outputEncoding } = {} ) {
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
                                    key = this.#storage.getSymmetricKey( keyId );

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
                key = this.#storage.getSymmetricKey( keyId );

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
}
