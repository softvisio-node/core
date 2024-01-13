import { Console } from "node:console";
import ansi from "#lib/text/ansi";

export default class Logger extends Console {
    #console;

    constructor ( { stdout, stderr, colorMode } = {} ) {
        super( {
            "stdout": stdout || process.stdout,
            "stderr": stderr || process.stderr,
            "colorMode": colorMode || "auto",
            "ignoreErrors": true,
        } );
    }

    // properties
    get console () {
        return this.#console || global.console;
    }

    // public
    installGlobalConsole () {
        if ( this.#console ) return;

        this.#console = global.console;

        global.console = this;

        return this;
    }

    restoreGlobalConsole () {
        if ( !this.#console ) return;

        global.console = this.#console;

        this.#console = null;

        return this;
    }

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
