import crypto from "node:crypto";
import * as asn1js from "asn1js";
import * as pkijs from "pkijs";
import externalResources from "#lib/external-resources";
import Interval from "#lib/interval";
import { resolve } from "#lib/utils";

// set crypto engine
pkijs.setEngine( "nodejs", new pkijs.CryptoEngine( { crypto } ) );

const DEFAULT_COMMON_NAME = "Self-signed certificate",
    DEFAULT_MAX_AGE = "10 years",
    ALGORITHM = {
        "name": "ECDSA",
        "namedCurve": "P-256",
        "hash": "SHA-256",
    };

const CERTIFICATES_RESOURCE = await externalResources.add( "softvisio-node/core/resources/certificates" ).check();

export const dhParamPath = resolve( "#resources/dh-param.pem", import.meta.url ),
    localDomain = "local.softvisio.net",
    localCertificatePath = CERTIFICATES_RESOURCE.getResourcePath( "local/certificate.pem" ),
    localPrivateKeyPath = CERTIFICATES_RESOURCE.getResourcePath( "local/private-key.pem " );

export async function createCertificate ( { commonName, maxAge } = {} ) {
    commonName ||= DEFAULT_COMMON_NAME;
    maxAge ||= DEFAULT_MAX_AGE;

    // create certificate
    const certificate = new pkijs.Certificate();
    certificate.version = 2;
    certificate.serialNumber = new asn1js.Integer( { "value": 1 } );

    // issuer common name
    certificate.issuer.typesAndValues.push( new pkijs.AttributeTypeAndValue( {
        "type": "2.5.4.3",
        "value": new asn1js.BmpString( { "value": commonName } ),
    } ) );

    // subject common name
    certificate.subject.typesAndValues.push( new pkijs.AttributeTypeAndValue( {
        "type": "2.5.4.3",
        "value": new asn1js.BmpString( { "value": commonName } ),
    } ) );

    // validity period
    certificate.notBefore.value = new Date();
    certificate.notAfter.value = Interval.new( maxAge ).addDate();

    // extensions are not a part of certificate by default, it's an optional array
    certificate.extensions = [];

    // "BasicConstraints" extension
    const basicConstr = new pkijs.BasicConstraints( {
        "cA": false,
    } );

    certificate.extensions.push( new pkijs.Extension( {
        "extnID": "2.5.29.19",
        "critical": true,
        "extnValue": basicConstr.toSchema().toBER( false ),
        "parsedValue": basicConstr,
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
        "parsedValue": keyUsage,
    } ) );

    // generate key pair
    const keyPair = await crypto.subtle.generateKey( ALGORITHM, true, [ "sign", "verify" ] );

    // exporting public key into "subjectPublicKeyInfo" value of certificate
    await certificate.subjectPublicKeyInfo.importKey( keyPair.publicKey );

    // signing final certificate
    await certificate.sign( keyPair.privateKey, ALGORITHM.hash );

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
    const keyPair = await crypto.subtle.generateKey( ALGORITHM, true, [ "sign", "verify" ] );

    const csr = new pkijs.CertificationRequest();

    csr.subject.typesAndValues.push( new pkijs.AttributeTypeAndValue( {
        "type": "2.5.4.3",
        "value": new asn1js.Utf8String( { "value": domains[ 0 ] } ),
    } ) );

    await csr.subjectPublicKeyInfo.importKey( keyPair.publicKey );

    csr.attributes = [];

    // subject alternative name
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

    // pkcs-9-at-extensionRequest
    csr.attributes.push( new pkijs.Attribute( {
        "type": "1.2.840.113549.1.9.14",
        "values": [
            new pkijs.Extensions( {
                "extensions": [

                    // id-ce-subjectKeyIdentifier
                    new pkijs.Extension( {
                        "extnID": "2.5.29.14",
                        "critical": false,
                        "extnValue": new asn1js.OctetString( { "valueHex": subjectKeyIdentifier } ).toBER( false ),
                    } ),

                    // id-ce-subjectAltName
                    new pkijs.Extension( {
                        "extnID": "2.5.29.17",
                        "critical": false,
                        "extnValue": altNames.toSchema().toBER( false ),
                    } ),

                    // pkcs-9-at-challengePassword
                    // new pkijs.Extension( {
                    //     "extnID": "1.2.840.113549.1.9.7",
                    //     "critical": false,
                    //     "extnValue": new asn1js.PrintableString( { "value": "passwordChallenge" } ).toBER( false ),
                    // } ),
                ],
            } ).toSchema(),
        ],
    } ) );

    // signing final PKCS#10 request
    await csr.sign( keyPair.privateKey, ALGORITHM.hash );

    return {
        "csr": csr.toString( "base64url" ),
        "privateKey": crypto.KeyObject.from( keyPair.privateKey ).export( {
            "type": "pkcs8",
            "format": "pem",
        } ),
    };
}
