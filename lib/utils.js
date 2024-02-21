export * from "#lib/_browser/utils";
export * from "@softvisio/utils/utils";

import module from "module";
import { pathToFileURL } from "url";

export async function confirm ( text, answers ) {
    const stdin = process.stdin;

    var defaultAnswer,
        shorts = {};

    process.stdout.write( text +
            " " +
            answers
                .map( answer => {
                    let short = answer.substring( 0, 1 );

                    shorts[ short ] = answer;

                    if ( !defaultAnswer ) {
                        defaultAnswer = short;

                        short = short.toUpperCase();
                    }

                    return `[${ short }]${ answer.substring( 1 ) }`;
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
            else if ( key === "\u000d" ) {
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
