import crypto from "node:crypto";
import stream from "node:stream";
import msgpack from "#lib/msgpack";

export function encrypt ( getKey, data, { inputEncoding, outputEncoding } = {} ) {
    if ( data == null ) return null;

    const key = getKey();

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

export function decrypt ( getKey, data, { inputEncoding, outputEncoding } = {} ) {
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

                        // try to decode header
                        const { "value": [ algorithm, keyId, iv, authTag ] = [], offset } = msgpack.decodeStream( buffer ) || {};

                        // header is not complete
                        if ( offset == null ) {
                            callback();
                        }

                        // header is complete
                        else {
                            const key = getKey( keyId );

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

        const {
                "value": [ algorithm, keyId, iv, authTag ],
                offset,
            } = msgpack.decodeStream( data ),
            key = getKey( keyId ),
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
