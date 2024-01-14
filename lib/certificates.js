import forge from "node-forge";

export async function createCertificate () {
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
        "key": pki.privateKeyToPem( keyPair.privateKey ),
    };
}
