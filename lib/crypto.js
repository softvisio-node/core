import crypto from "node:crypto";
import stream from "node:stream";
import externalResources from "#lib/external-resources";
import forge from "#lib/forge";
import Interval from "#lib/interval";
import msgpack from "#lib/msgpack";
import { resolve } from "#lib/utils";

const DEFAULT_RSA_KEY_SIZE = 4096,
    CERTIFICATES_RESOURCE = await externalResources.add( "softvisio-node/core/resources/certificates" ).check();

async function getKeyPair ( privateKey ) {
    var keyPair;

    if ( !privateKey ) {
        privateKey = await new Promise( ( resolve, reject ) => {
            crypto.generateKeyPair(
                "rsa",
                {
                    "modulusLength": DEFAULT_RSA_KEY_SIZE,
                },
                ( e, publicKey, privateKey ) => {
                    if ( e ) {
                        reject( e );
                    }
                    else {
                        resolve( privateKey );
                    }
                }
            );
        } );
    }

    // export private key to pem
    if ( typeof privateKey !== "string" ) {
        privateKey = privateKey.export( {
            "type": "pkcs8",
            "format": "pem",
        } );
    }

    privateKey = forge.pki.privateKeyFromPem( privateKey );

    keyPair = {
        privateKey,
        "publicKey": forge.pki.setRsaPublicKey( privateKey.n, privateKey.e ),
    };

    return keyPair;
}

export const dhParamPath = resolve( "#resources/dh-param.pem", import.meta.url ),
    localDomain = "local.softvisio.net",
    localCertificatePath = CERTIFICATES_RESOURCE.getResourcePath( "local/certificate.pem" ),
    localPrivateKeyPath = CERTIFICATES_RESOURCE.getResourcePath( "local/private-key.pem " );

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

export async function createCertificate ( { privateKey, maxAge } = {} ) {
    const cert = forge.pki.createCertificate();

    // XXX
    // the serial number can be decimal or hex (if preceded by 0x)
    // toPositiveHex( forge.util.bytesToHex( forge.random.getBytesSync( 9 ) ) )
    cert.serialNumber = "01";

    cert.validity.notBefore = new Date();

    cert.validity.notAfter = new Interval( maxAge || "1 year" ).addDate();

    const attrs = [
        {
            "name": "commonName",
            "value": "",
        },
        {
            "name": "countryName",
            "value": "",
        },
        {
            "shortName": "ST",
            "value": "",
        },
        {
            "name": "localityName",
            "value": "",
        },
        {
            "name": "organizationName",
            "value": "",
        },
        {
            "shortName": "OU",
            "value": "",
        },
    ];

    cert.setSubject( attrs );
    cert.setIssuer( attrs );

    const keyPair = await getKeyPair( privateKey );

    cert.publicKey = keyPair.publicKey;

    cert.sign( keyPair.privateKey );

    return {
        "certificate": forge.pki.certificateToPem( cert ),
        "privateKey": forge.pki.privateKeyToPem( keyPair.privateKey ),
    };
}

export async function createCsr ( domains, { privateKey } = {} ) {
    if ( !Array.isArray( domains ) ) domains = [ domains ];

    // create a certification request (CSR)
    const csr = forge.pki.createCertificationRequest();

    csr.setSubject( [
        {
            "name": "commonName",
            "value": domains[ 0 ],
        },

        // {
        //     "name": "countryName",
        //     "value": "US",
        // },
        // {
        //     "shortName": "ST",
        //     "value": "Virginia",
        // },
        // {
        //     "name": "localityName",
        //     "value": "Blacksburg",
        // },
        // {
        //     "name": "organizationName",
        //     "value": "Test",
        // },
        // {
        //     "shortName": "OU",
        //     "value": "Test",
        // },
    ] );

    // set (optional) attributes
    csr.setAttributes( [

        // {
        //     "name": "challengePassword",
        //     "value": "password",
        // },
        // {
        //     "name": "unstructuredName",
        //     "value": "My Company, Inc.",
        // },
        {
            "name": "extensionRequest",
            "extensions": [
                {
                    "name": "subjectAltName",
                    "altNames": domains.map( domain => {
                        return {

                            // 2 is DNS type
                            "type": 2,
                            "value": domain,
                        };
                    } ),
                },
            ],
        },
    ] );

    // generate a key pair
    const keyPair = await getKeyPair( privateKey );

    csr.publicKey = keyPair.publicKey;

    // sign certification request
    csr.sign( keyPair.privateKey, forge.md.sha256.create() );

    return {
        "csr": forge.pki.certificationRequestToPem( csr ),
        "privateKey": forge.pki.privateKeyToPem( keyPair.privateKey ),
    };
}
