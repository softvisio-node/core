/** summary: Util functions.
 */

module.exports = { ...require( "./util/browser" ) };

/** function: confirm
 * summary: Get user confirmation.
 * description: Prints question and reads user input. First answer in options become default. Default answer is used when user pressed `ENTER` or if  `STDIN` is not `TTY` (in this case default answer returning automatically).
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
 *         maxBufSize: 1
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
 * async: true
 * params:
 *   - name: host
 *     schema:
 *       type: string
 *       format: hostname
 */
module.exports.getRandomFreePort = async function ( host ) {
    const net = require( "net" );

    return new Promise( resolve => {
        const srv = net.createServer( sock => sock.end() );

        srv.listen( 0, host, () => {
            const port = srv.address().port;

            srv.close();

            resolve( port );
        } );
    } );
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

/** function: readChunk
 * summary: Read chunk of data with the specified length from the stream.
 * async: true
 * params:
 *   - name: stream
 *     required: true
 *     schema:
 *       type: Stream
 *   - name: chunkLength
 *     required: true
 *     schema:
 *       type: number
 *   - name: options
 *     schema:
 *       type: object
 *       properties:
 *         - encoding:
 *             type: string
 *             default: ~
 *       additionalProperties: false
 */
module.exports.readChunk = async function ( stream, chunkLength, options = {} ) {

    // chunk is already buffered
    if ( stream.readableLength >= chunkLength ) return options.encoding ? stream.read( chunkLength ).toString( options.encoding ) : stream.read( chunkLength );

    return new Promise( resolve => {
        const onClose = function () {
            resolve();
        };

        const onReadable = function () {
            if ( stream.readableLength >= chunkLength ) {

                // remove events listeners
                stream.off( "close", onClose );
                stream.off( "readable", onReadable );

                resolve( options.encoding ? stream.read( chunkLength ).toString( options.encoding ) : stream.read( chunkLength ) );
            }
        };

        // set events listeners
        stream.once( "close", onClose );
        stream.on( "readable", onReadable );
    } );
};

/** function: readLine
 * summary: Read line of data from the stream.
 * async: true
 * params:
 *   - name: stream
 *     required: true
 *     schema:
 *       type: Stream
 *   - name: options
 *     schema:
 *       type: object
 *       properties:
 *         eol:
 *           summary: Line separator.
 *           type: string
 *           default: |+
 *
 *         encoding:
 *           type: string
 *           default: ~
 *         maxBufSize:
 *           summary: Maximum internal buffer size.
 *           default: 65536
 *           type: number
 */
module.exports.readLine = async function ( stream, options = {} ) {
    if ( options.eol == null ) options.eol = "\n";
    if ( options.maxBufSize == null ) options.maxBufSize = 1024 * 64;

    var buf, idx;

    if ( stream.readableLength ) {
        buf = stream.read();

        idx = buf.indexOf( options.eol );

        if ( idx !== -1 ) {
            stream.unshift( buf.slice( idx + options.eol.length ) );

            return options.encoding ? buf.slice( 0, idx ).toString( options.encoding ) : buf.slice( 0, idx );
        }
    }

    return new Promise( resolve => {
        const onClose = function () {
            resolve();
        };

        const onReadable = function () {
            buf = buf ? Buffer.concat( [buf, stream.read()] ) : stream.read();

            if ( buf == null ) return;

            idx = buf.indexOf( options.eol );

            // eol found
            if ( idx !== -1 ) {

                // remove events listeners
                stream.off( "close", onClose );
                stream.off( "readable", onReadable );

                if ( buf.length > idx + options.eol.length ) stream.unshift( buf.slice( idx + options.eol.length ) );

                resolve( options.encoding ? buf.slice( 0, idx ).toString( options.encoding ) : buf.slice( 0, idx ) );
            }

            // eol not found, max internal buffer size reached
            else if ( buf.size >= options.maxBufSize ) {

                // remove events listeners
                stream.off( "close", onClose );
                stream.off( "readable", onReadable );

                stream.unshift( buf );

                resolve();
            }
        };

        // set events listeners
        stream.once( "close", onClose );
        stream.on( "readable", onReadable );
    } );
};
