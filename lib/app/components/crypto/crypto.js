import crypto from "node:crypto";
import stream from "node:stream";
import msgpack from "#lib/msgpack";
import sql from "#lib/sql";

const MASTER_KEY_ID = -1;

export default class Env {
    #app;
    #config;
    #key;
    #keys;
    #defaultAesKey;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get dbh () {
        return this.#app.dbh;
    }

    // public
    // XXX
    async init () {

        // create master key
        this.#key = {
            "id": MASTER_KEY_ID,
            "key": crypto.createSecretKey( this.#config.key, "base64url" ),
        };

        if ( this.#key.symmetricKeyType !== "secret" || this.#key.symmetricKeySize !== 32 ) {
            return result( [ 400, `AES key 256 bits length is required` ] );
        }

        var res;

        if ( this.dbh ) {

            // migrate database
            res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
            if ( !res.ok ) return res;
        }

        // load keys
        res = await this.#loadKeys();
        if ( !res.ok ) return res;

        // XXX
        if ( !this.#defaultAesKey ) {

            // create default symmetric key
            res = await this.#createDefaultAesKey();
            if ( !res ) return res;

            // load keys
            res = await this.#loadKeys();
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    encrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return this.#encrypt( data, { inputEncoding, outputEncoding } );
    }

    decrypt ( data, { inputEncoding, outputEncoding } = {} ) {
        return this.decrypt( data, { inputEncoding, outputEncoding } );
    }

    // private
    // XXX
    async #loadKeys () {
        var res;

        this.#keys = {};
        this.#defaultAesKey = null;

        if ( this.dbh ) {

            // load keys
            res = await this.dbh.select( sql`SELECT * FROM crypto_key` );
            if ( !res.ok ) return res;

            if ( res.data ) {
                for ( const key of res.data ) {
                    key.key = crypto.createSecretKey( this.#decrypt( key.key, {
                        "inputEncoding": "base64url",
                    } ) );

                    this.#keys[ key.id ] = key;

                    if ( key.type === "aes" && key.enabled ) {
                        this.#defaultAesKey = key;
                    }
                }
            }
        }
        else {

            // XXX
        }

        return result( 200 );
    }

    #encrypt ( data, { key, inputEncoding, outputEncoding } = {} ) {
        if ( data == null ) return null;

        key ||= this.#defaultAesKey;

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
                            ] ),
                            size = Buffer.alloc( 2 );

                        size.writeUInt16BE( header.length );

                        this.push( size );
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
                ] ),
                size = Buffer.alloc( 2 );

            size.writeUInt16BE( header.length );

            const buffer = Buffer.concat( [

                //
                size,
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
                    if ( !decipher ) {
                        if ( typeof chunk === "string" ) {
                            chunk = Buffer.from( chunk, encoding );
                        }

                        if ( buffer ) {
                            buffer = Buffer.concat( buffer, chunk );
                        }
                        else {
                            buffer = chunk;
                        }

                        if ( buffer.length < 2 ) {
                            callback();
                        }
                        else {
                            const size = buffer.readUInt16BE();

                            if ( buffer.length < size + 2 ) {
                                callback();
                            }
                            else {
                                try {
                                    const [ algorithm, keyId, iv, authTag ] = msgpack.decode( buffer.subarray( 2, size + 2 ) ),
                                        key = keyId === MASTER_KEY_ID
                                            ? this.#key
                                            : this.#keys[ keyId ];

                                    decipher = crypto.createDecipheriv( algorithm, key.key, iv );

                                    if ( authTag ) {
                                        decipher.setAuthTag( authTag );
                                    }

                                    callback( null, decipher.update( buffer.subarray( size + 2 ) ) );
                                }
                                catch ( e ) {
                                    callback( e );
                                }
                            }
                        }
                    }
                    else {
                        callback( null, decipher.update( chunk, encoding ) );
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

            const size = data.readUInt16BE(),
                [ algorithm, keyId, iv, authTag ] = msgpack.decode( data.subarray( 2, size + 2 ) ),
                key = keyId === MASTER_KEY_ID
                    ? this.#key
                    : this.#keys[ keyId ];

            const decipher = crypto.createDecipheriv( algorithm, key.key, iv );

            if ( authTag ) {
                decipher.setAuthTag( authTag );
            }

            const buffer = Buffer.concat( [

                //
                decipher.update( data.subarray( size + 2 ) ),
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

    async #createDefaultAesKey () {
        return new Promise( resolve => {
            crypto.generateKey(
                "aes",
                {
                    "length": 256,
                },
                ( e, key ) =>
                    resolve( key
                        .export( {
                            "format": "buffer",
                        } )
                        .toString( "base64url" ) )
            );
        } );
    }
}
