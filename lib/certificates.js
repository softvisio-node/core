import crypto from "node:crypto";
import forge from "#lib/forge";

class Certificates {

    // public
    createCertificate () {
        const pki = forge.pki;

        const keyPair = pki.rsa.generateKeyPair( 2048 );

        var cert = pki.createCertificate();

        cert.publicKey = keyPair.publicKey;

        // XXX
        // the serial number can be decimal or hex (if preceded by 0x)
        // toPositiveHex( forge.util.bytesToHex( forge.random.getBytesSync( 9 ) ) )
        cert.serialNumber = "01";

        cert.validity.notBefore = new Date();

        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear( cert.validity.notBefore.getFullYear() + 1 );

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

        cert.sign( keyPair.privateKey );

        const pem = pki.certificateToPem( cert );

        return {
            "certificate": pem,
            "privateKey": pki.privateKeyToPem( keyPair.privateKey ),
        };
    }

    async createEcdsaKeyPair ( namedCurve = "P-256" ) {
        const keyPair = await new Promise( ( resolve, reject ) => {
            crypto.generateKeyPair(
                "ec",
                {
                    namedCurve,
                    "privateKeyEncoding": {
                        "type": "pkcs8",
                        "format": "pem",
                    },
                },
                ( e, publicKey, privateKey ) => {
                    if ( e ) {
                        reject( e );
                    }
                    else {
                        resolve( { publicKey, privateKey } );
                    }
                }
            );
        } );

        return keyPair;
    }

    async createCsr ( domains ) {

        // const { privateKey } = crypto.generateKeyPairSync( "rsa", {
        //     "modulusLength": 2048,
        //     "publicKeyEncoding": {
        //         "type": "pkcs1",
        //         "format": "pem",
        //     },
        //     "privateKeyEncoding": {
        //         "type": "pkcs1",
        //         "format": "pem",
        //     },
        // } );

        const keyPair = await this.createEcdsaKeyPair();

        const csrInfo = [

            //
            "-----BEGIN CERTIFICATE REQUEST-----",
            "CN=example.com",
            "O=Example Organization",
            "L=San Francisco",
            "ST=California",
            "C=US",
            "-----END CERTIFICATE REQUEST-----",
        ];

        const csr = crypto.createSign( "RSA-SHA256" );

        csr.update( csrInfo.join( "\n" ) + "\n" );

        csr.end();

        // specify format and type
        // var signature = sign.sign( { "key": privateKeyPkcs8Der, "format": "der", "type": "pkcs8" } );
        // const csrData = csr.sign( keyPair.privateKey, "base64" );
        const csrData = csr.sign( {
            "key": keyPair.privateKey,
            "format": "der",
            "type": "pkcs8",
        } );

        return {
            "csr": csrData,
            "privateKey": keyPair.privateKey,
        };
    }
}

export default new Certificates();
