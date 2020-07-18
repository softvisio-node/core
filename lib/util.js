/** summary: Util functions.
 */

const defaultMinPort = 10000;
const defaultMaxPort = 65535;
const defaultExcludedPorts = {
    "80": true, // http
    "5432": true, // postgres
};

module.exports = require( "./util/browser" );

/** function: fromBase64u
 * summary: Decode string from Base64 url-encoded format to `Buffer`.
 * description: Returns `Buffer`.
 * params:
 *   - name: str
 *     summary: Base64 encoded string.
 *     required: true
 *     schema:
 *       type: string
 */
module.exports.fromBase64u = function ( str ) {
    str = str.replace( /-/g, "+" ).replace( /_/g, "/" );

    str += "===".slice( ( str.length + 3 ) % 4 );

    return Buffer.from( str, "base64" );
};

/** function: toBase64u
 * summary: Encode Base64 string or `Buffer` to Base64 url-encoded format.
 * description: Returns `string`.
 * params:
 *   - name: val
 *     summary: String or `Buffer`.
 *     required: true
 *     schema:
 *       type: string
 */
module.exports.toBase64u = function ( val ) {
    if ( Buffer.isBuffer( val ) ) val = val.toString( "base64" );

    return val.replace( /\+/g, "-" ).replace( /\//g, "_" ).replace( /=+$/, "" );
};

module.exports.bytesToUuid = require( "./util/bytes-to-uuid" );

/** function: confirm
 * summary: Get user confirmation.
 * description: >-
 *   Prints question and reads user input. First answer in options become default.
 *   Default answer is used when user pressed `ENTER` or if  `STDIN` is not `TTY`
 *   (in this case default answer returning automatically).
 * async: true
 * params:
 *   - name: text
 *     summary: Prompt text.
 *     required: true
 *     schema:
 *       type: string
 *   - name: options
 *     summary: Possible answers. Array of characters in lower case.
 *     required: true
 *     schema:
 *       type: array
 *       minItems: 1
 *       items:
 *         type: string
 *         minLength: 1
 *         maxLength: 1
 */
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
            "] " );

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

/** function: getRandomFreePort
 * summary: Returns random free port.
 * description: |-
 *   Default excluded ports:
 *     - 80;
 *     - 5432;
 * async: true
 * params:
 *   - name: options
 *     schema:
 *       type: object
 *       additionalProperties: false
 *       properties:
 *         ip:
 *           type: string
 *           format: ipv4
 *         minPort:
 *           type: number
 *         maxPort:
 *           type: number
 *         exclude:
 *           type: array
 *           items:
 *             type: number
 */
module.exports.getRandomFreePort = async function ( options = {} ) {
    const checked = options.exclude ? Object.fromEntries( options.exclude.map( port => [port, true] ) ) : {};

    while ( 1 ) {
        const port = Math.floor( Math.random() * ( ( options.maxPort || defaultMaxPort ) - ( options.minPort || defaultMinPort ) + 1 ) + ( options.minPort || defaultMinPort ) );

        if ( checked[port] ) continue;

        if ( defaultExcludedPorts[port] ) continue;

        if ( await portIsFree( port, options.ip ) ) return port;

        checked[port] = true;
    }
};

/** function: portIsFree
 * summary: Check if port is free.
 * async: true
 * params:
 *   - name: port
 *     required: true
 *     schema:
 *       type: number
 *   - name: ip
 *     schema:
 *       type: string
 *       format: ipv4
 */
async function portIsFree ( port, ip ) {
    const net = require( "net" );

    return new Promise( resolve => {
        const socket = new net.Socket();

        const cleanup = function () {
            socket.removeAllListeners();
            socket.end();
            socket.destroy();
            socket.unref();
        };

        socket.once( "connect", () => {
            cleanup();

            // port is busy
            resolve( false );
        } );

        socket.once( "error", e => {
            cleanup();

            // port is free
            if ( e.code === "ECONNREFUSED" ) {
                resolve( true );
            }

            // error
            else {
                resolve( false );
            }
        } );

        socket.connect( { "port": port, "host": ip }, function () {} );
    } );
}

module.exports.portIsFree = portIsFree;
