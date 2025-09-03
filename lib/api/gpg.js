import "#lib/result";
import childProcess from "node:child_process";

const GPG_BINARY = "gpg" + ( process.platform === "win32"
        ? ".exe"
        : "" ),
    KEY_VALIDITY = {
        "o": "unknown",
        "i": "invalid",
        "d": "disabled",
        "D": "disabled",
        "r": "revoked",
        "e": "expired",
        "-": "",
        "q": "",
        "n": "not valid",
        "m": "marginal valid",
        "f": "fully valid",
        "u": "ultimately valid",
        "w": " well known private part",
        "s": "special validity",

        // XXX in "sig" records, this field may have one of these values as first character:
        // "!": "signature is good",
        // "-": "signature is bad",
        // "?": "no public key to verify signature or public key is not usable",
        // "%": "other error verifying a signature",
    },
    KEY_CAPABILITIES = {
        "a": "authentication",
        "c": "certify",
        "e": "encrypt",
        "s": "sign",
        "r": "restricted encryption",
        "t": "timestamping",
        "g": "group key",
        "?": "unknown",
        "d": "disabled key",
    };

export default class Gpg {

    // public
    async getKeys () {
        return new Promise( resolve => {
            childProcess.execFile(
                GPG_BINARY,
                [ "--list-secret-keys", "--with-colons", "--with-keygrip", "--with-fingerprint" ],
                {
                    "windowsHide": true,
                },
                ( error, stdout, stdoerr ) => {
                    if ( error ) {
                        resolve( result.catch( error, { "log": false } ) );
                    }
                    else {
                        try {
                            stdout = stdout.replace( /^.*?sec/ms, "sec" );

                            const data = [],
                                lines = stdout.split( "\n" );

                            let key, subkey;

                            for ( let line of lines ) {
                                line = line.trim();
                                if ( !line ) continue;

                                const fields = this.#parseColumns( line );

                                // sec
                                if ( fields.type === "sec" ) {
                                    key = {
                                        "id": fields.keyId,
                                        "curveName": fields.curveName,
                                        "validity": fields.validity,
                                        "validityText": KEY_VALIDITY[ fields.validity ],
                                        "creationDate": fields.creationDate,
                                        "expirationDate": fields.expirationDate,
                                        "fingerprint": null,
                                        "grip": null,
                                        "capabilities": fields.keyCapabilities
                                            .split( "" )
                                            .map( capability => KEY_CAPABILITIES[ capability ] )
                                            .filter( capability => capability ),
                                        "fullCapabilities": [
                                            ...new Set( fields.keyCapabilities
                                                .toLowerCase()
                                                .split( "" )
                                                .map( keyCapability => KEY_CAPABILITIES[ keyCapability ] ) ),
                                        ],
                                        "uids": {},
                                        "subkeys": [],
                                    };

                                    data.push( key );

                                    subkey = null;
                                }

                                // ssb
                                else if ( fields.type === "ssb" ) {
                                    subkey = {
                                        "id": fields.keyId,
                                        "curveName": fields.curveName,
                                        "validity": fields.validity,
                                        "validityText": KEY_VALIDITY[ fields.validity ],
                                        "creationDate": fields.creationDate,
                                        "expirationDate": fields.expirationDate,
                                        "fingerprint": null,
                                        "grip": null,
                                        "capabilities": fields.keyCapabilities.split( "" ).map( capability => KEY_CAPABILITIES[ capability ] ),
                                    };

                                    key.subkeys.push( subkey );
                                }

                                // uid
                                else if ( fields.type === "uid" ) {
                                    const uid = fields.userId;

                                    let name, email;

                                    const match = uid.match( /^(?<name>.+) <(?<email>.+)>$/ );

                                    if ( match ) {
                                        name = match.groups.name;
                                        email = match.groups.email;
                                    }
                                    else {
                                        name = null;
                                        email = uid;
                                    }

                                    key.uids[ email ] = {
                                        uid,
                                        email,
                                        name,
                                        "validity": fields.validity,
                                        "validityText": KEY_VALIDITY[ fields.validity ],
                                    };
                                }

                                // fingerprint
                                else if ( fields.type === "fpr" ) {
                                    const fingerprint = fields.userId;

                                    if ( subkey ) {
                                        subkey.fingerprint = fingerprint;
                                    }
                                    else {
                                        key.fingerprint = fingerprint;
                                    }
                                }

                                // grip
                                else if ( fields.type === "grp" ) {
                                    const grip = fields.userId;

                                    if ( subkey ) {
                                        subkey.grip = grip;
                                    }
                                    else {
                                        key.grip = grip;
                                    }
                                }

                                // invalid
                                else {
                                    throw "Key parsing error";
                                }
                            }

                            resolve( result( 200, data ) );
                        }
                        catch ( e ) {
                            resolve( result.catch( e, { "log": false } ) );
                        }
                    }
                }
            );
        } );
    }

    // XXX /usr/lib/gnupg/gpg-preset-passphrase
    async unlockKey () {}

    async encrypt ( data, key, { inputEncoding, outputEncoding, password } = {} ) {}

    async decrypt () {}

    async sign () {}

    async verify () {}

    // private
    #parseColumns ( line ) {
        var fields = line.split( ":" );

        // DOCS: https://github.com/gpg/gnupg/blob/master/doc/DETAILS
        fields = {
            "type": fields[ 0 ],
            "validity": fields[ 1 ],
            "keyLength": fields[ 2 ],
            "publicKeyAlgorithm": fields[ 3 ],
            "keyId": fields[ 4 ],
            "creationDate": fields[ 5 ]
                ? new Date( Number( fields[ 5 ] ) * 1000 )
                : null,
            "expirationDate": fields[ 6 ]
                ? new Date( Number( fields[ 6 ] ) * 1000 )
                : null,

            // XXX
            "field8": fields[ 7 ], // Certificate S/N, UID hash, trust signature info
            "ownertrust": fields[ 8 ],
            "userId": fields[ 9 ],
            "signatureClass": fields[ 10 ],
            "keyCapabilities": fields[ 11 ],
            "issuerCertificateFingerprint": fields[ 12 ],
            "flag": fields[ 13 ],
            "tokenSerialNumber": fields[ 14 ],
            "hashAlgorithm": fields[ 15 ],
            "curveName": fields[ 16 ],
            "complianceFlags": fields[ 17 ],
            "lastUpdate": fields[ 18 ],
            "origin": fields[ 19 ],
            "comment": fields[ 20 ],
        };

        return fields;
    }
}
