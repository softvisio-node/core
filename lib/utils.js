import childProcess from "node:child_process";
import module from "node:module";
import readline from "node:readline";
import { pathToFileURL } from "node:url";
import ansi from "#lib/text/ansi";

export * from "@softvisio/utils/utils";
export * from "#lib/_browser/utils";

export async function confirm ( text, answers ) {
    answers ||= [ "[yes]", "no" ];

    const stdin = process.stdin;

    var defaultAnswer,
        shorts = {};

    process.stdout.write( text +
            " " +
            answers
                .map( answerText => {
                    let answer, isDefaultAnswer, short;

                    // [answer] - default
                    if ( answerText.startsWith( "[" ) && answerText.endsWith( "]" ) ) {
                        isDefaultAnswer = true;

                        answerText = answerText.slice( 1, -1 );
                    }

                    short = answerText.match( /\((.)\)/ )?.[ 1 ];

                    // take (.) as short
                    if ( short ) {
                        answer = answerText.replaceAll( "(", "" ).replaceAll( ")", "" );
                    }

                    // take first character as short
                    else {
                        short = answerText.slice( 0, 1 );

                        answer = answerText;

                        answerText = "(" + short + ")" + answerText.slice( 1 );
                    }

                    shorts[ short ] = answer;

                    if ( !defaultAnswer && isDefaultAnswer ) {
                        defaultAnswer = short;

                        answerText = ansi.underline( answerText );
                    }

                    return answerText;
                } )
                .join( ", " ) +
            ": " );

    // use default answer for non-tty
    if ( !process.stdout.isTTY ) {
        console.log( shorts[ defaultAnswer ] || "cancelled" );

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
                resolve();
            }

            // esc
            else if ( key === "\u001B" ) {
                resolve();
            }

            // enter
            else if ( key === "\u000D" ) {

                // use default answer
                if ( shorts[ defaultAnswer ] ) {
                    stdin.off( "data", onData );

                    resolve( shorts[ defaultAnswer ] );
                }
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

    console.log( answer || "cancelled" );

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

export async function repeatAction ( action, repeat ) {
    repeat ||= async () => ( await confirm( "Repeat?", [ "[yes]", "no" ] ) ) === "yes";

    var res;

    while ( true ) {
        try {
            res = result.try( await action() );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        if ( res.ok ) {
            return res;
        }
        else {
            const repeatAction = await repeat();

            if ( repeatAction ) {
                continue;
            }
            else {
                return res;
            }
        }
    }
}
