import crypto from "node:crypto";
import forge from "#lib/forge";
import Interval from "#lib/interval";

class Certificates {

    // public
    async createCertificate () {
        const cert = forge.pki.createCertificate();

        // XXX
        // the serial number can be decimal or hex (if preceded by 0x)
        // toPositiveHex( forge.util.bytesToHex( forge.random.getBytesSync( 9 ) ) )
        cert.serialNumber = "01";

        cert.validity.notBefore = new Date();

        cert.validity.notAfter = new Interval( "1 year" ).toDate();

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

        const keyPair = await this.#generateKeyPair();

        cert.publicKey = keyPair.publicKey;

        cert.sign( keyPair.privateKey );

        return {
            "certificate": forge.pki.certificateToPem( cert ),
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

    // XXX
    async createCsr1 ( domains ) {
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
        const keyPair = await this.createEcdsaKeyPair();

        await this.#signCsr( csr, keyPair );

        return {
            "csr": forge.pki.certificationRequestToPem( csr ),
            "privateKey": keyPair.privateKey,
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
            forge.pki.rsa.generateKeyPair( { "bits": 4096, "workers": -1 }, ( err, keypair ) => resolve( keypair ) );
        } );
    }

    // XXX
    async #signCsr ( csr, keyPair ) {

        // XXX
        csr.signatureOid = "SHA256withECDSA";

        // XXX
        const keyPair1 = await this.#generateKeyPair();
        csr.publicKey = keyPair1.publicKey;

        csr.certificationRequestInfo = forge.pki.getCertificationRequestInfo( csr );

        // XXX patch private key

        const sign = crypto.createSign( "SHA256" );

        const bytes = forge.asn1.toDer( csr.certificationRequestInfo );
        sign.write( new Uint8Array( bytes.getBytes() ) );

        sign.end();

        csr.signature = sign.sign( keyPair.privateKey, "latin1" );
    }
}

export default new Certificates();
