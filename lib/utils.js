/** summary: Util functions.
 */

export * from "./utils/common.js";

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
}
