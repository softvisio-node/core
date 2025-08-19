import "#lib/result";
import childProcess from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import stream from "node:stream";
import fetch from "#lib/fetch";
import * as Base64Stream from "#lib/stream/base64";
import { Decrypt, Encrypt } from "#lib/stream/crypto";
import * as HexStream from "#lib/stream/hex";
import { TmpFile } from "#lib/tmp";

const SSH_SECRETS = new Map(),
    ALLOWED_ENCODINGS = new Set( [ "ascii", "buffer", "latin1", "utf8" ] );

// public
export { getCipherInfo } from "#lib/stream/crypto";

export async function hash ( algorithm, data, { inputEncoding, outputEncoding } = {} ) {
    const hash = crypto.createHash( algorithm );

    if ( data instanceof stream.Readable ) {
        const pipeline = createPipeline( data, null, { inputEncoding } );

        for await ( const chunk of pipeline ) {
            hash.update( chunk );
        }
    }
    else {
        hash.update( data, inputEncoding );
    }

    return hash.digest( outputEncoding );
}

export async function hmac ( algorithm, key, data, { inputEncoding, outputEncoding } = {} ) {
    const hmac = crypto.createHmac( algorithm, key );

    if ( data instanceof stream.Readable ) {
        const pipeline = createPipeline( data, null, { inputEncoding } );

        for await ( const chunk of pipeline ) {
            hmac.update( chunk );
        }
    }
    else {
        hmac.update( data, inputEncoding );
    }

    return hmac.digest( outputEncoding );
}

export async function encrypt ( data, { inputEncoding, outputEncoding, ...options } = {} ) {
    var isStream;

    if ( data instanceof stream.Readable ) {
        isStream = true;
    }
    else {
        data = stream.Readable.from( data );
    }

    const pipeline = createPipeline( data, new Encrypt( options ), { inputEncoding, outputEncoding } );

    if ( isStream ) {
        return pipeline;
    }
    else if ( outputEncoding ) {
        return pipeline.text();
    }
    else {
        return pipeline.buffer();
    }
}

export async function decrypt ( data, { inputEncoding, outputEncoding, ...options } = {} ) {
    var isStream;

    if ( data instanceof stream.Readable ) {
        isStream = true;
    }
    else {
        data = stream.Readable.from( data );
    }

    const pipeline = createPipeline( data, new Decrypt( options ), { inputEncoding, outputEncoding } );

    if ( isStream ) {
        return pipeline;
    }
    else if ( outputEncoding ) {
        return pipeline.text();
    }
    else {
        return pipeline.buffer();
    }
}

export async function encryptSsh ( gitHubUsername, data, { inputEncoding, outputEncoding, cache } = {} ) {
    var res;

    res = await getSshSecret( gitHubUsername, { cache } );
    if ( !res.ok ) throw res;
    const secret = res.data;

    return encrypt( data, {
        inputEncoding,
        outputEncoding,
        "preset": "openssl",
        "key": secret,
    } );
}

export async function decryptSsh ( gitHubUsername, data, { inputEncoding, outputEncoding, cache } = {} ) {
    var res;

    res = await getSshSecret( gitHubUsername, { cache } );
    if ( !res.ok ) throw res;
    const secret = res.data;

    return decrypt( data, {
        inputEncoding,
        outputEncoding,
        "preset": "openssl",
        "key": secret,
    } );
}

export async function sign ( algorithm, data, privateKey, { inputEncoding, outputEncoding } = {} ) {
    const sign = crypto.createSign( algorithm );

    if ( data instanceof stream.Readable ) {
        const pipeline = createPipeline( data, null, { inputEncoding } );

        for await ( const chunk of pipeline ) {
            sign.update( chunk );
        }
    }
    else {
        sign.update( data, inputEncoding );
    }

    return sign.sign( privateKey, outputEncoding );
}

export async function verify ( algorithm, data, publicKey, signature, { inputEncoding, signatureEncoding } = {} ) {
    const verify = crypto.createVerify( algorithm );

    if ( data instanceof stream.Readable ) {
        const pipeline = createPipeline( data, null, { inputEncoding } );

        for await ( const chunk of pipeline ) {
            verify.update( chunk );
        }
    }
    else {
        verify.update( data, inputEncoding );
    }

    return verify.verify( publicKey, signature, signatureEncoding );
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
        const proc = childProcess.spawn( "ssh-keygen", [ "-Y", "sign", "-n", "ssh-crypt", "-q", "-f", tmpFile.path ], {
            "encoding": "buffer",
            "stdio": [ "pipe", "pipe", "pipe" ],
        } );

        const stdout = [],
            stderr = [];

        proc.once( "error", e => resolve( result( [ 500, e.message ] ) ) );

        proc.stdout.on( "data", data => stdout.push( data ) );

        proc.stderr.on( "data", data => stderr.push( data ) );

        proc.once( "close", code => {
            var res;

            tmpFile.destroy();

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

function createPipeline ( inputStream, ouputStream, { inputEncoding, outputEncoding } = {} ) {
    const streams = [ inputStream ];

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
        else if ( !ALLOWED_ENCODINGS.has( inputEncoding ) ) {
            throw new Error( "Input encoding is not valid" );
        }
    }

    if ( ouputStream ) {
        streams.push( ouputStream );
    }

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
        else if ( !ALLOWED_ENCODINGS.has( outputEncoding ) ) {
            throw new Error( "Output encoding is not valid" );
        }
    }

    if ( streams.length === 1 ) {
        return inputStream;
    }
    else {
        return stream.pipeline( ...streams, () => {} );
    }
}
