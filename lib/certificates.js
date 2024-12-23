import crypto from "node:crypto";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import Interval from "#lib/interval";

// set crypto engine
pkijs.setEngine( "nodejs", new pkijs.CryptoEngine( { "crypto": crypto } ) );

const algorithm = {
    "name": "ECDSA",
    "namedCurve": "P-256",
    "hash": "SHA-256",
};

export async function createCertificate ( { commonName, maxAge } = {} ) {
    commonName ||= "Self-signed certificate";
    maxAge ||= "1 year";

    // create certificate
    const certificate = new pkijs.Certificate();
    certificate.version = 2;
    certificate.serialNumber = new asn1js.Integer( { "value": 1 } );
    certificate.issuer.typesAndValues.push( new pkijs.AttributeTypeAndValue( {
        "type": "2.5.4.3", // common name
        "value": new asn1js.BmpString( { "value": commonName } ),
    } ) );
    certificate.subject.typesAndValues.push( new pkijs.AttributeTypeAndValue( {
        "type": "2.5.4.3", // Common name
        "value": new asn1js.BmpString( { "value": commonName } ),
    } ) );

    // set a validity period
    certificate.notBefore.value = new Date();
    certificate.notAfter.value = Interval.new( maxAge ).addDate();

    certificate.extensions = []; // Extensions are not a part of certificate by default, it's an optional array

    // "BasicConstraints" extension
    const basicConstr = new pkijs.BasicConstraints( {
        "cA": false,
    } );

    certificate.extensions.push( new pkijs.Extension( {
        "extnID": "2.5.29.19",
        "critical": true,
        "extnValue": basicConstr.toSchema().toBER( false ),
        "parsedValue": basicConstr, // Parsed value for well-known extensions
    } ) );

    // "KeyUsage" extension
    const bitArray = new ArrayBuffer( 1 ),
        bitView = new Uint8Array( bitArray );

    bitView[ 0 ] |= 1 << 7; // Key usage "digitalSignature" flag
    bitView[ 0 ] |= 1 << 8; // Key usage "nonRepudiation" flag

    const keyUsage = new asn1js.BitString( { "valueHex": bitArray } );

    certificate.extensions.push( new pkijs.Extension( {
        "extnID": "2.5.29.15",
        "critical": true,
        "extnValue": keyUsage.toBER( false ),
        "parsedValue": keyUsage, // Parsed value for well-known extensions
    } ) );

    // generate key pair
    const keyPair = await crypto.subtle.generateKey( algorithm, true, [ "sign", "verify" ] );

    // exporting public key into "subjectPublicKeyInfo" value of certificate
    await certificate.subjectPublicKeyInfo.importKey( keyPair.publicKey );

    // signing final certificate
    await certificate.sign( keyPair.privateKey, algorithm.hash );

    return {
        "certificate": `-----BEGIN CERTIFICATE-----
${ certificate.toString( "base64" ) }
-----END CERTIFICATE-----
`,
        "privateKey": crypto.KeyObject.from( keyPair.privateKey ).export( {
            "type": "pkcs8",
            "format": "pem",
        } ),
    };
}

export async function createCsr ( domains ) {
    if ( !Array.isArray( domains ) ) domains = [ domains ];

    // generate key pair
    const keyPair = await crypto.subtle.generateKey( algorithm, true, [ "sign", "verify" ] );

    const csr = new pkijs.CertificationRequest();

    csr.subject.typesAndValues.push( new pkijs.AttributeTypeAndValue( {
        "type": "2.5.4.3",
        "value": new asn1js.Utf8String( { "value": domains[ 0 ] } ),
    } ) );

    await csr.subjectPublicKeyInfo.importKey( keyPair.publicKey );

    csr.attributes = [];

    // subject alternative Name
    const altNames = new pkijs.GeneralNames( {
        "names": domains.map( domain =>
            new pkijs.GeneralName( {
                "type": 2,
                "value": domain,
            } ) ),
    } );

    // subject key identifier
    const subjectKeyIdentifier = await crypto.subtle.digest(
        {
            "name": "SHA-1",
        },
        csr.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHex
    );

    csr.attributes.push( new pkijs.Attribute( {
        "type": "1.2.840.113549.1.9.14", // pkcs-9-at-extensionRequest
        "values": [
            new pkijs.Extensions( {
                "extensions": [
                    new pkijs.Extension( {
                        "extnID": "2.5.29.14", // id-ce-subjectKeyIdentifier
                        "critical": false,
                        "extnValue": new asn1js.OctetString( { "valueHex": subjectKeyIdentifier } ).toBER( false ),
                    } ),
                    new pkijs.Extension( {
                        "extnID": "2.5.29.17", // id-ce-subjectAltName
                        "critical": false,
                        "extnValue": altNames.toSchema().toBER( false ),
                    } ),

                    // new pkijs.Extension( {
                    //     "extnID": "1.2.840.113549.1.9.7", // pkcs-9-at-challengePassword
                    //     "critical": false,
                    //     "extnValue": new asn1js.PrintableString( { "value": "passwordChallenge" } ).toBER( false ),
                    // } ),
                ],
            } ).toSchema(),
        ],
    } ) );

    // signing final PKCS#10 request
    await csr.sign( keyPair.privateKey, algorithm.hash );

    return {
        "csr": csr.toString( "base64url" ),
        "privateKey": crypto.KeyObject.from( keyPair.privateKey ).export( {
            "type": "pkcs8",
            "format": "pem",
        } ),
    };
}
