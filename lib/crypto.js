import crypto from "node:crypto";
import stream from "node:stream";
import msgpack from "#lib/msgpack";

export async function encrypt ( key, data, { inputEncoding, outputEncoding } = {} ) {
    if ( data == null ) return null;

    if ( typeof key === "function" ) {
        key = await key();
    }

    var keyId;

    if ( key.key ) {
        keyId = key.id;
        key = key.key;
    }

    keyId ??= null;

    // stream
    if ( data instanceof stream.Readable ) {
        const iv = crypto.randomBytes( 16 ),
            cipher = crypto.createCipheriv( "aes-256-cbc", key, iv );

        let headerPushed;

        const transformStream = new stream.Transform( {
            transform ( chunk, encoding, callback ) {
                if ( !headerPushed ) {
                    headerPushed = true;

                    const header = msgpack.encode( [

                        //
                        "aes-256-cbc",
                        keyId,
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

        return stream.pipeline( data, transformStream, () => {} );
    }

    // buffer
    else {
        const iv = crypto.randomBytes( 12 ),
            cipher = crypto.createCipheriv( "aes-256-gcm", key, iv ),
            buf1 = cipher.update( data, inputEncoding ),
            buf2 = cipher.final(),
            header = msgpack.encode( [

                //
                "aes-256-gcm",
                keyId,
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

export async function decrypt ( key, data, { inputEncoding, outputEncoding } = {} ) {
    if ( data == null ) return null;

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

        return stream.pipeline( data, transformStream, () => {} );
    }

    // buffer
    else {
        if ( typeof data === "string" ) {
            data = Buffer.from( data, inputEncoding );
        }

        const {
            "value": [ algorithm, keyId, iv, authTag ],
            offset,
        } = msgpack.decodeStream( data );

        if ( typeof key === "function" ) {
            key = await key( keyId );
        }

        if ( key.key ) key = key.key;

        const decipher = crypto.createDecipheriv( algorithm, key, iv );

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
