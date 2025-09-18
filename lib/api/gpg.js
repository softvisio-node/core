import "#lib/result";
import childProcess from "node:child_process";
import path from "node:path";
import File from "#lib/file";
import { exists } from "#lib/fs";
import stream from "#lib/stream";

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
        "w": "well known private part",
        "s": "special validity",

        // XXX in "sig" records, this field may have one of these values as first character:
        // "!": "signature is good",
        // "-": "signature is bad",
        // "?": "no public key to verify signature or public key is not usable",
        // "%": "other error verifying a signature",
    },
    KEY_IS_VALID = new Set( [ "m", "f", "u", "w", "s" ] ),
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

var GPG_PRESET_PASSPHRASE_BINARY;

export default class Gpg {
    #cacheKeys;

    // public
    async getPrivateKeys ( { cacheKeys = true } = {} ) {
        if ( cacheKeys && this.#cacheKeys ) return result( 200, this.#cacheKeys );

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
                                        "validity": {
                                            "type": fields.validity,
                                            "text": KEY_VALIDITY[ fields.validity ],
                                            "isValid": KEY_IS_VALID.has( fields.validity ),
                                        },
                                        "creationDate": fields.creationDate,
                                        "expirationDate": fields.expirationDate,
                                        "fingerprint": null,
                                        "grip": null,
                                        "capabilities": Object.fromEntries( fields.keyCapabilities.split( "" ).map( capability => [ capability, KEY_CAPABILITIES[ capability.toLowerCase() ] ] ) ),
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
                                        "validity": {
                                            "type": fields.validity,
                                            "text": KEY_VALIDITY[ fields.validity ],
                                            "isValid": KEY_IS_VALID.has( fields.validity ),
                                        },
                                        "creationDate": fields.creationDate,
                                        "expirationDate": fields.expirationDate,
                                        "fingerprint": null,
                                        "grip": null,
                                        "capabilities": Object.fromEntries( fields.keyCapabilities.split( "" ).map( capability => [ capability, KEY_CAPABILITIES[ capability ] ] ) ),
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
                                        "validity": {
                                            "type": fields.validity,
                                            "text": KEY_VALIDITY[ fields.validity ],
                                            "isValid": KEY_IS_VALID.has( fields.validity ),
                                        },
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

                            this.#cacheKeys = data;

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

    // XXX
    async unlockKeys ( keys, { cacheKeys } = {} ) {
        const gpgPresetPassphraseBinary = await this.#getGpgPresetPassphraseBinary();
        if ( !gpgPresetPassphraseBinary ) return result( 500 );

        const res = await this.getPrivateKeys( { cacheKeys } );
        if ( !res.ok ) return res;

        const keygrips = new Map();

        for ( const [ keyId, password ] of Object.entries( keys ) ) {
            var foundKey;

            for ( const key of res.data ) {
                if ( keyId === key.id ) {
                    foundKey = key;

                    break;
                }

                for ( const uid of Object.values( key.uids ) ) {
                    if ( uid.uid.includes( keyId ) ) {
                        if ( foundKey ) return result( [ 400, "GPG key is ambigous" ] );

                        foundKey = key;
                    }
                }
            }

            // key not found
            if ( !foundKey ) return result( [ 404, "GPG key not found" ] );

            keygrips.set( foundKey.grip, password );

            for ( const subkey of foundKey.subkeys ) keygrips.set( subkey.grip, password );
        }

        if ( keygrips.size ) {
            for ( const [ keygrip, password ] of keygrips.entries() ) {
                const res = await new Promise( resolve => {
                    try {
                        const proc = childProcess.spawn( gpgPresetPassphraseBinary, [ "--preset", keygrip ], {
                            "stdio": [ "pipe", "ignore", "ignore" ],
                        } );

                        proc.once( "error", e => resolve( result.catch( e, { "log": false } ) ) );

                        proc.once( "close", code => {
                            var res;

                            if ( code ) {
                                res = result( 500 );
                            }
                            else {
                                res = result( 200 );
                            }

                            resolve( res );
                        } );

                        proc.stdin.write( password );
                        proc.stdin.end();
                    }
                    catch ( e ) {
                        resolve( result.catch( e, { "log": false } ) );
                    }
                } );

                if ( !res.ok ) return res;
            }
        }

        return result( 200 );
    }

    async encrypt ( data, recipients, { cwd, armor, output, sign, cacheKeys = true } = {} ) {
        const args = [ "--pinentry-mode", "loopback", "--output", output || "-" ];

        if ( armor ) args.push( "--armor" );

        // sign
        if ( sign ) {
            args.push( "--sign" );

            if ( !Array.isArray( sign ) ) sign = [ sign ];

            let keys;

            for ( const user of sign ) {
                args.push( "--local-user", user.key );

                if ( user.password ) {
                    keys ||= {};
                    keys[ user.key ] = user.password;
                }
            }

            if ( keys ) {
                const res = await this.unlockKeys( keys, { cacheKeys } );

                if ( !res.ok ) return res;
            }
        }

        // encrypt
        args.push( "--encrypt" );

        if ( !Array.isArray( recipients ) ) recipients = [ recipients ];

        for ( const recipient of recipients ) {
            args.push( "--recipient", recipient );
        }

        return this.#spawnGpg( args, {
            cwd,
            "input": data,
            "outputStream": !output,
        } );
    }

    async decrypt () {}

    async sign ( data, users, { cwd, armor, output, encrypt, cacheKeys = true } = {} ) {
        const args = [ "--pinentry-mode", "loopback", "--output", output || "-" ];

        if ( armor ) args.push( "--armor" );

        // sign
        args.push( "--sign" );

        if ( !Array.isArray( users ) ) users = [ users ];

        let keys;

        for ( const user of users ) {
            args.push( "--local-user", user.key );

            if ( user.password ) {
                keys ||= {};
                keys[ user.key ] = user.password;
            }
        }

        if ( keys ) {
            const res = await this.unlockKeys( keys, { cacheKeys } );

            if ( !res.ok ) return res;
        }

        // encrypt
        if ( encrypt ) {
            args.push( "--encrypt" );

            if ( !Array.isArray( encrypt ) ) encrypt = [ encrypt ];

            for ( const recipient of encrypt ) {
                args.push( "--recipient", recipient );
            }
        }

        return this.#spawnGpg( args, {
            cwd,
            "input": data,
            "outputStream": !output,
        } );
    }

    async detachSign ( data, users, { cwd, armor, output, cacheKeys = true } = {} ) {
        const args = [ "--pinentry-mode", "loopback", "--output", output || "-" ];

        if ( armor ) args.push( "--armor" );

        // sign
        args.push( "--detach-sign" );

        if ( !Array.isArray( users ) ) users = [ users ];

        let keys;

        for ( const user of users ) {
            args.push( "--local-user", user.key );

            if ( user.password ) {
                keys ||= {};
                keys[ user.key ] = user.password;
            }
        }

        if ( keys ) {
            const res = await this.unlockKeys( keys, { cacheKeys } );

            if ( !res.ok ) return res;
        }

        return this.#spawnGpg( args, {
            cwd,
            "input": data,
            "outputStream": !output,
        } );
    }

    async clearSign ( data, users, { cwd, armor, output, cacheKeys = true } = {} ) {
        const args = [ "--pinentry-mode", "loopback", "--output", output || "-" ];

        if ( armor ) args.push( "--armor" );

        // sign
        args.push( "--clear-sign" );

        if ( !Array.isArray( users ) ) users = [ users ];

        let keys;

        for ( const user of users ) {
            args.push( "--local-user", user.key );

            if ( user.password ) {
                keys ||= {};
                keys[ user.key ] = user.password;
            }
        }

        if ( keys ) {
            const res = await this.unlockKeys( keys, { cacheKeys } );

            if ( !res.ok ) return res;
        }

        return this.#spawnGpg( args, {
            cwd,
            "input": data,
            "outputStream": !output,
        } );
    }

    async verify () {}

    async importKeys ( data ) {}

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

    async #getGpgPresetPassphraseBinary () {
        if ( GPG_PRESET_PASSPHRASE_BINARY == null ) {
            GPG_PRESET_PASSPHRASE_BINARY = "";

            if ( process.platform === "win32" ) {
                let gpgDir;

                for ( const dir of process.env.PATH.split( ";" ) ) {
                    if ( await exists( dir + "/gpg.exe" ) ) {
                        gpgDir = dir;

                        break;
                    }
                }

                if ( gpgDir ) {
                    if ( await exists( gpgDir + "/gpg-preset-passphrase.exe" ) ) {
                        GPG_PRESET_PASSPHRASE_BINARY = path.join( gpgDir, "gpg-preset-passphrase.exe" );
                    }
                    else if ( await exists( gpgDir + "/../lib/gnupg/gpg-preset-passphrase.exe" ) ) {
                        GPG_PRESET_PASSPHRASE_BINARY = path.join( gpgDir, "../lib/gnupg/gpg-preset-passphrase.exe" );
                    }
                }
            }
            else {
                GPG_PRESET_PASSPHRASE_BINARY = "/usr/lib/gnupg/gpg-preset-passphrase";
            }
        }

        return GPG_PRESET_PASSPHRASE_BINARY;
    }

    #createStream ( data ) {
        if ( data instanceof stream.Readable ) {
            return data;
        }
        else if ( data instanceof File ) {
            return data.stream();
        }
        else {
            return stream.Readable.from( data );
        }
    }

    async #spawnGpg ( args, { cwd, input, outputStream } = {} ) {
        try {
            const proc = childProcess.spawn( GPG_BINARY, args, {
                cwd,
                "stdio": [ input
                    ? "pipe"
                    : "ignore", outputStream
                    ? "pipe"
                    : "ignore", "ignore" ],
            } );

            if ( input ) {
                stream.pipeline( this.#createStream( input ), proc.stdin, e => {} );
            }

            if ( outputStream ) {
                return result( 200, {
                    "stream": proc.stdout,
                } );
            }
            else {
                return new Promise( resolve => {
                    proc.once( "close", ( code, signal ) => {
                        if ( code ) {
                            resolve( result( 500 ) );
                        }
                        else {
                            resolve( result( 200 ) );
                        }
                    } );
                } );
            }
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }
    }
}
