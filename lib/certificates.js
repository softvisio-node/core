import crypto from "node:crypto";
import forge from "#lib/forge";

class Certificates {

    // public
    async createCertificate () {
        const keyPair = await this.#generateKeyPair();

        var cert = forge.pki.createCertificate();

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

        const pem = forge.pki.certificateToPem( cert );

        return {
            "certificate": pem,
            "privateKey": forge.pki.privateKeyToPem( keyPair.privateKey ),
        };
    }

    async createCsr ( domains ) {
        if ( !Array.isArray( domains ) ) domains = [domains];

        // create a certification request (CSR)
        const csr = forge.pki.createCertificationRequest();

        csr.setSubject( [
            {
                "name": "commonName",
                "value": domains[0],
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
        const keyPair = await this.#generateKeyPair();

        csr.publicKey = keyPair.publicKey;

        // sign certification request
        csr.sign( keyPair.privateKey, forge.md.sha256.create() );

        return {
            "csr": forge.pki.certificationRequestToPem( csr ),
            "privateKey": forge.pki.privateKeyToPem( keyPair.privateKey ),
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

    // private
    async #generateKeyPair () {
        return new Promise( resolve => {
            forge.pki.rsa.generateKeyPair( { "bits": 2048, "workers": -1 }, ( err, keypair ) => resolve( keypair ) );
        } );
    }
}

export default new Certificates();
