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
        if ( !Array.isArray( domains ) ) domains = [domains];

        // generate a key pair
        // const keyPair = forge.pki.rsa.generateKeyPair( 2048 );

        const keyPair = await this.createEcdsaKeyPair();

        // create a certification request (CSR)
        const csr = forge.pki.createCertificationRequest();

        csr.publicKey = keyPair.publicKey;

        csr.setSubject( [
            {
                "name": "commonName",
                "value": "example.org",
            },
            {
                "name": "countryName",
                "value": "US",
            },
            {
                "shortName": "ST",
                "value": "Virginia",
            },
            {
                "name": "localityName",
                "value": "Blacksburg",
            },
            {
                "name": "organizationName",
                "value": "Test",
            },
            {
                "shortName": "OU",
                "value": "Test",
            },
        ] );

        // set (optional) attributes
        csr.setAttributes( [
            {
                "name": "challengePassword",
                "value": "password",
            },
            {
                "name": "unstructuredName",
                "value": "My Company, Inc.",
            },
            {
                "name": "extensionRequest",
                "extensions": [
                    {
                        "name": "subjectAltName",
                        "altNames": [
                            {

                                // 2 is DNS type
                                "type": 2,
                                "value": "test.domain.com",
                            },
                            {
                                "type": 2,
                                "value": "other.domain.com",
                            },
                            {
                                "type": 2,
                                "value": "www.domain.net",
                            },
                        ],
                    },
                ],
            },
        ] );

        // sign certification request
        csr.sign( keyPair.privateKey );

        // verify certification request
        // var verified = csr.verify();

        // convert certification request to PEM-format
        var pem = forge.pki.certificationRequestToPem( csr );

        // convert a Forge certification request from PEM-format
        // var csr = forge.pki.certificationRequestFromPem( pem );

        // get an attribute
        // csr.getAttribute( { "name": "challengePassword" } );

        // get extensions array
        // csr.getAttribute( { "name": "extensionRequest" } ).extensions;

        return {
            "csr": pem,
        };
    }
}

export default new Certificates();
