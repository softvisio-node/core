import childProcess from "node:child_process";
import module from "node:module";
import readline from "node:readline";
import { pathToFileURL } from "node:url";

export * from "@softvisio/utils/utils";
export * from "#lib/_browser/utils";

export async function confirm ( text, answers ) {
    const stdin = process.stdin;

    var defaultAnswer,
        shorts = {};

    process.stdout.write( text +
            " " +
            answers
                .map( answer => {
                    let short = answer.slice( 0, 1 );

                    shorts[ short ] = answer;

                    if ( !defaultAnswer ) {
                        defaultAnswer = short;

                        short = short.toUpperCase();
                    }

                    return `[${ short }]${ answer.slice( 1 ) }`;
                } )
                .join( " / " ) +
            " " );

    // use default answer for non-tty
    if ( !process.stdout.isTTY ) {
        console.log( shorts[ defaultAnswer ] );

        return shorts[ defaultAnswer ];
    }

    const isRaw = stdin.isRaw;
    if ( !isRaw ) stdin.setRawMode( true );

    stdin.resume();

    const answer = await new Promise( resolve => {
        const onData = key => {
            if ( Buffer.isBuffer( key ) ) key = key.toString( "utf8" );

            // ctrl+c
            if ( key === "\u0003" ) {
                console.log( "^C" );

                process.exit( 3 );
            }

            // enter
            else if ( key === "\u000D" ) {
                stdin.off( "data", onData );

                resolve( shorts[ defaultAnswer ] );
            }
            else if ( shorts[ key ] ) {
                stdin.off( "data", onData );

                resolve( shorts[ key ] );
            }
        };

        stdin.on( "data", onData );
    } );

    stdin.pause();

    if ( !isRaw ) stdin.setRawMode( isRaw );

    console.log( answer );

    return answer;
}

export async function prompt ( text ) {
    const readlineInterface = readline.createInterface( {
        "input": process.stdin,
        "output": process.stdout,
    } );

    return new Promise( resolve => {
        readlineInterface.question( text, res => {
            readlineInterface.close();

            resolve( res );
        } );
    } );
}

export function resolve ( path, from, { url, silent } = {} ) {
    try {
        var targetPath = module.createRequire( from ).resolve( path );
    }
    catch ( e ) {
        if ( silent ) {
            return;
        }
        else {
            throw e;
        }
    }

    if ( url ) {
        return pathToFileURL( targetPath );
    }
    else {
        return targetPath;
    }
}

export function copyToClipboard ( string ) {
    if ( process.platform === "win32" ) {
        childProcess.spawnSync( "clip", {
            "input": string,
        } );
    }
    else if ( process.platform === "linux" ) {
        childProcess.spawnSync( "xclip", {
            "input": string,
        } );
    }
    else if ( process.platform === "darwin" ) {
        childProcess.spawnSync( "pbcopy", {
            "input": string,
        } );
    }
}
