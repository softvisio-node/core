import "#lib/result";
import childProcess from "node:child_process";

const GPG_BINARY = "gpg" + ( process.platform === "win32"
        ? ".exe"
        : "" ),
    KEY_TYPES = {
        "A": "authenticate",
        "C": "certificate",
        "E": "encrypt",
        "S": "sign",
    };

export default class Gpg {

    // public
    async getKeys () {
        return new Promise( resolve => {
            childProcess.execFile(
                GPG_BINARY,
                [ "--list-secret-keys", "--with-keygrip", "--with-fingerprint" ],
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

                                // sec
                                if ( line.startsWith( "sec" ) ) {
                                    const match = line.match( /^sec\s+(?<algorithm>[^/]+)\/(?<id>[^ ]+)\s+(?<date>\d{4}(?:-\d{2}){2})\s+\[(?<type>[ACES])]$/ );
                                    if ( !match ) throw "Key parsing error";

                                    key = {
                                        "id": match.groups.id,
                                        "algorithm": match.groups.algorithm,
                                        "date": match.groups.date,
                                        "fingerprint": null,
                                        "grip": null,
                                        "types": match.groups.type.split( "" ).map( type => KEY_TYPES[ type ] ),
                                        "uids": {},
                                        "subkeys": [],
                                    };

                                    data.push( key );

                                    subkey = null;
                                }

                                // ssb
                                else if ( line.startsWith( "ssb" ) ) {
                                    const match = line.match( /^ssb\s+(?<algorithm>[^/]+)\/(?<id>[^ ]+)\s+(?<date>\d{4}(?:-\d{2}){2})\s+\[(?<type>[ACES])]$/ );
                                    if ( !match ) throw "Key parsing error";

                                    subkey = {
                                        "id": match.groups.id,
                                        "algorithm": match.groups.algorithm,
                                        "date": match.groups.date,
                                        "grip": null,
                                        "types": match.groups.type.split( "" ).map( type => KEY_TYPES[ type ] ),
                                    };

                                    key.subkeys.push( subkey );
                                }

                                // uid
                                else if ( line.startsWith( "uid" ) ) {
                                    const match = line.match( /^uid\s+\[(?<trust>[^\]]+)]\s+(?<uid>.+)$/ );
                                    if ( !match ) throw "Key parsing error";

                                    const uid = match.groups.uid;

                                    let name, email;

                                    const match1 = uid.match( /^(?<name>.+) <(?<email>.+)>$/ );

                                    if ( match1 ) {
                                        name = match1.groups.name;
                                        email = match1.groups.email;
                                    }
                                    else {
                                        name = null;
                                        email = uid;
                                    }

                                    key.uids[ email ] = {
                                        uid,
                                        email,
                                        name,
                                        "trust": match.groups.trust,
                                    };
                                }

                                // fingerprint
                                else if ( line.startsWith( "Key fingerprint" ) ) {
                                    key.fingerprint = line.replace( /^Key fingerprint = /, "" ).replaceAll( " ", "" );
                                }

                                // grip
                                else if ( line.startsWith( "Keygrip" ) ) {
                                    const grip = line.replace( /^Keygrip = /, "" );

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

    async encrypt ( file, key, { inputEncoding, outputEncoding, password } = {} ) {}

    async decrypt () {}

    async sign () {}

    async verify () {}
}
