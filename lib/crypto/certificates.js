import { createPrivateKey, createPublicKey, generateKeyPair, sign } from "node:crypto";
import * as asn from "simple-asn1";
import { TAGS } from "simple-asn1";

export async function createCsr ( domains ) {
    if ( !Array.isArray( domains ) ) domains = [ domains ];

    const keyPair = await new Promise( resolve => {
        generateKeyPair(
            "ec",
            {
                "namedCurve": "P-256",
            },
            ( e, publicKey, privateKey ) => resolve( { publicKey, privateKey } )
        );
    } );

    const commonName = domains[ 0 ],
        dnsNames = domains;

    const publicKeySpki = keyPair.publicKey.export( {
            "format": "pem",
            "type": "spki",
        } ),
        privateKeyPkcs8 = keyPair.privateKey.export( {
            "format": "pem",
            "type": "pkcs8",
        } ),
        privKeyObj = createPrivateKey( privateKeyPkcs8 );

    const subject = asn.encodeDERSequence( [ asn.encodeDERSet( [ asn.encodeDERAttribute( "2.5.4.3", commonName ) ] ) ] );

    const extensionRequest = createExtensionRequest( dnsNames );

    const certificationRequestInfo = asn.encodeDERSequence( [
        Buffer.from( [ TAGS.INTEGER, TAGS.BOOLEAN, TAGS.ZERO ] ), // version
        subject, // subject
        await encodeSubjectPublicKeyInfo( publicKeySpki ), // pki
        asn.encodeDERContextSpecific( 0, extensionRequest ), // attributes with extension request
    ] );

    const signature = await signData( certificationRequestInfo, privKeyObj );
    const signatureAlgorithm = asn.encodeDERSequence( [ asn.encodeDERObjectIdentifier( "1.2.840.10045.4.3.2" ) ] );

    const csrDer = asn.encodeDERSequence( [ certificationRequestInfo, signatureAlgorithm, asn.encodeDERBitString( signature ) ] );

    return {
        "csr": `-----BEGIN CERTIFICATE REQUEST-----
${ csrDer.toString( "base64" ) }
-----END CERTIFICATE REQUEST-----
`,
        "privateKey": keyPair.privateKey.export( {
            "type": "pkcs8",
            "format": "pem",
        } ),
    };
}

async function encodeSubjectPublicKeyInfo ( publicKeyDer ) {
    let derKey = publicKeyDer;

    if ( typeof publicKeyDer === "string" && publicKeyDer.includes( "-----BEGIN PUBLIC KEY-----" ) ) {
        const pemContent = publicKeyDer.replace( "-----BEGIN PUBLIC KEY-----", "" ).replace( "-----END PUBLIC KEY-----", "" ).replaceAll( /\s+/g, "" );

        derKey = Buffer.from( pemContent, "base64" );
    }

    const tempKey = createPublicKey( {
        "key": Buffer.from( derKey ),
        "format": "der",
        "type": "spki",
    } );

    const rawKey = tempKey.export( {
        "format": "der",
        "type": "spki",
    } );

    const ecPoint = extractEcPoint( rawKey );

    return asn.encodeDERSequence( [ asn.encodeDERSequence( [ asn.encodeDERObjectIdentifier( "1.2.840.10045.2.1" ), asn.encodeDERObjectIdentifier( "1.2.840.10045.3.1.7" ) ] ), asn.encodeDERBitString( Buffer.concat( [ Buffer.from( [ TAGS.OCTET_STRING ] ), ecPoint ] ) ) ] );
}

function createExtensionRequest ( dnsNames ) {
    const extensions = [];

    if ( dnsNames.length > 0 ) {
        extensions.push( createSanExtension( dnsNames ) );
    }

    return asn.encodeDERSequence( [ asn.encodeDERObjectIdentifier( "1.2.840.113549.1.9.14" ), asn.encodeDERSet( [ asn.encodeDERSequence( extensions ) ] ) ] );
}

function createSanExtension ( dnsNames ) {
    const generalNames = [];

    dnsNames.forEach( dns => {
        const dnsBytes = Buffer.from( dns, "utf8" );
        generalNames.push( Buffer.concat( [ Buffer.from( [ 0x82 ] ), asn.encodeDERLength( dnsBytes.length ), dnsBytes ] ) );
    } );

    const sanSequence = Buffer.concat( [ Buffer.from( [ TAGS.SEQUENCE ] ), asn.encodeDERLength( generalNames.reduce( ( sum, el ) => sum + el.length, 0 ) ), ...generalNames ] );

    return asn.encodeDERSequence( [ asn.encodeDERObjectIdentifier( "2.5.29.17" ), asn.encodeDEROctetString( sanSequence ) ] );
}

function signData ( data, privateKey ) {
    return new Promise( ( resolve, reject ) => {
        sign( "sha256", data, privateKey, ( err, sig ) => {
            if ( err ) reject( new Error( `Signing failed: ${ err.message }` ) );
            resolve( sig );
        } );
    } );
}

export function extractEcPoint ( derKey ) {
    let offset = 0;

    if ( derKey[ offset++ ] !== TAGS.SEQUENCE ) throw new Error( "Expected sequence" );
    offset += asn.skipDERLength( derKey.slice( offset ) );

    if ( derKey[ offset++ ] !== TAGS.SEQUENCE ) throw new Error( "Expected algorithm sequence" );
    const algLength = asn.readDERLength( derKey.slice( offset ) );
    offset += asn.skipDERLength( derKey.slice( offset ) ) + algLength;

    if ( derKey[ offset++ ] !== 0x03 ) throw new Error( "Expected bit string" );
    const bitStringLength = asn.readDERLength( derKey.slice( offset ) );
    offset += asn.skipDERLength( derKey.slice( offset ) );

    offset++;

    const remainingLength = bitStringLength - 1;
    if ( remainingLength !== derKey.length - offset ) {
        throw new Error( "Invalid bit string length for EC point" );
    }

    if ( derKey[ offset ] !== TAGS.OCTET_STRING ) {
        throw new Error( "Expected uncompressed EC point (TAGS.OCTET_STRING)" );
    }

    const point = derKey.slice( offset + 1, offset + remainingLength );

    if ( point.length !== 64 ) {
        throw new Error( `Invalid EC point length: ${ point.length } (expected 64 bytes)` );
    }

    return point;
}
