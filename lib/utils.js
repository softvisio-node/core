export * from "#lib/_browser/utils";

import module from "module";
import { pathToFileURL } from "url";

export async function confirm ( text, options ) {
    const stdin = process.stdin,
        defaultAnswer = options.shift(),
        answers = { [defaultAnswer.toLowerCase()]: defaultAnswer };

    process.stdout.write( text +
            " [" +
            [
                defaultAnswer.toUpperCase(),
                ...options.map( answer => {
                    answers[answer.toLowerCase()] = answer;

                    return answer.toLowerCase();
                } ),
            ].join( "/" ) +
            "] " );

    // use default answer for non-tty
    if ( !process.stdout.isTTY ) {
        console.log( defaultAnswer );

        return answers[defaultAnswer];
    }

    const isRaw = stdin.isRaw;
    if ( !isRaw ) stdin.setRawMode( true );

    stdin.resume();

    return new Promise( resolve => {
        stdin.on( "data", function onData ( key ) {
            if ( Buffer.isBuffer( key ) ) key = key.toString( "utf8" );

            // ctrl+c
            if ( key === "\u0003" ) {
                console.log( "^C" );

                process.exit( 3 );
            }

            // enter
            else if ( key === "\u000d" ) {
                console.log( defaultAnswer );

                stdin.off( "data", onData );
                if ( !isRaw ) stdin.setRawMode( isRaw );
                stdin.pause();

                resolve( answers[defaultAnswer] );
            }
            else if ( answers[key] != null ) {
                console.log( answers[key] );

                stdin.off( "data", onData );
                if ( !isRaw ) stdin.setRawMode( isRaw );
                stdin.pause();

                resolve( answers[key] );
            }
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
