import childProcess from "node:child_process";
import module from "node:module";
import readline from "node:readline";
import { fileURLToPath, pathToFileURL } from "node:url";
import ansi from "#lib/ansi";

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

    let SIGINT;

    const answer = await new Promise( resolve => {
        const onData = key => {
            if ( Buffer.isBuffer( key ) ) key = key.toString( "utf8" );

            // ctrl+c
            if ( key === "\u0003" ) {
                SIGINT = true;

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

    // re-throw SIGINT
    if ( SIGINT ) process.kill( process.pid, "SIGINT" );

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

// XXX replace with resolve1()
export function resolve ( path, from, { url } = {} ) {
    const targetPath = module.createRequire( from ).resolve( path );

    if ( url ) {
        return pathToFileURL( targetPath );
    }
    else {
        return targetPath;
    }
}

// XXX enable when --experimental-import-meta-resolve
export function resolve1 ( path, from, { asPath } = {} ) {
    const target = import.meta.resolve( path, from );

    if ( asPath ) {
        return fileURLToPath( target );
    }
    else {
        return target;
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

export function shellEscape ( args, { shell } = {} ) {
    if ( !Array.isArray( args ) ) args = [ args ];

    return args
        .filter( arg => arg != null )
        .map( arg => {
            return arg;
        } )
        .join( " " );
}
