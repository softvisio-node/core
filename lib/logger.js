import { Console } from "node:console";
import ansi from "#lib/text/ansi";

export default class Logger extends Console {
    constructor () {
        super( {
            "stdout": process.stdout,
            "stderr": process.stderr,
            "ignoreErrors": true,

            // "colorMode": "auto",
        } );
    }

    // public
    write ( ...args ) {
        this._stdout.write( args.join( " " ) );
    }

    debug ( ...args ) {
        super.debug( ansi.dim( "[D]" ), ...args );
    }

    info ( ...args ) {
        super.info( ansi.ok( "[I]" ), ...args );
    }

    warn ( ...args ) {
        super.warn( ansi.warn( "[W]" ), ...args );
    }

    error ( ...args ) {
        super.error( ansi.error( "[E]" ), ...args );
    }
}
