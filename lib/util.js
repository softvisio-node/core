module.exports = require( "./util/browser" );

module.exports.fromBase64u = function ( str ) {
    str = str.replace( /-/g, "+" ).replace( /_/g, "/" );

    str += "===".slice( ( str.length + 3 ) % 4 );

    return Buffer.from( str, "base64" );
};

module.exports.toBase64u = function ( val ) {
    if ( Buffer.isBuffer( val ) ) val = val.toString( "base64" );

    return val.replace( /\+/g, "-" ).replace( /\//g, "_" ).replace( /=+$/, "" );
};

module.exports.bytesToUuid = require( "./util/bytes-to-uuid" );

module.exports.confirm = async function ( text, options ) {
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
            "]" );

    if ( !process.stdout.isTTY ) {
        console.log( defaultAnswer );

        return answers[defaultAnswer];
    }

    stdin.setRawMode( true );
    stdin.setEncoding( "utf8" );
    stdin.resume();

    return new Promise( resolve => {
        stdin.on( "data", function onData ( key ) {

            // CTRL+C
            if ( key === "\u0003" ) {
                process.exit();
            }

            // ENTER
            else if ( key === "\u000d" ) {
                console.log( defaultAnswer );

                stdin.pause();
                stdin.off( "data", onData );

                resolve( answers[defaultAnswer] );
            }
            else if ( answers[key] != null ) {
                console.log( answers[key] );

                stdin.pause();
                stdin.off( "data", onData );

                resolve( answers[key] );
            }
        } );
    } );
};
