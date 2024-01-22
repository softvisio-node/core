import forge from "#lib/forge";
import Interval from "#lib/interval";

class Certificates {

    // public
    async createCertificate ( { privateKey, maxAge } = {} ) {
        const cert = forge.pki.createCertificate();

        // XXX
        // the serial number can be decimal or hex (if preceded by 0x)
        // toPositiveHex( forge.util.bytesToHex( forge.random.getBytesSync( 9 ) ) )
        cert.serialNumber = "01";

        cert.validity.notBefore = new Date();

        cert.validity.notAfter = new Interval( maxAge || "1 year" ).toDate();

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

        const keyPair = await this.#getKeyPair( privateKey );

        cert.publicKey = keyPair.publicKey;

        cert.sign( keyPair.privateKey );

        return {
            "certificate": forge.pki.certificateToPem( cert ),
            "privateKey": forge.pki.privateKeyToPem( keyPair.privateKey ),
        };
    }

    async createCsr ( domains, { privateKey } = {} ) {
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
        const keyPair = await this.#getKeyPair( privateKey );

        csr.publicKey = keyPair.publicKey;

        // sign certification request
        csr.sign( keyPair.privateKey, forge.md.sha256.create() );

        return {
            "csr": forge.pki.certificationRequestToPem( csr ),
            "privateKey": forge.pki.privateKeyToPem( keyPair.privateKey ),
        };
    }

    // private
    // XXX
    async #getKeyPair ( privateKey ) {
        var keyPair;

        if ( privateKey ) {
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
        }
        else {
            keyPair = await new Promise( resolve => {
                forge.pki.rsa.generateKeyPair(
                    {
                        "bits": 4096,
                        "workers": -1,
                    },
                    ( err, keypair ) => resolve( keypair )
                );
            } );
        }

        return keyPair;
    }

    async #generateKeyPair ( size = 4096 ) {
        return new Promise( resolve => {
            forge.pki.rsa.generateKeyPair(
                {
                    "bits": size,
                    "workers": -1,
                },
                ( e, keypair ) => resolve( keypair )
            );
        } );
    }
}

export default new Certificates();
