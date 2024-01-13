import { Console } from "node:console";
import ansi from "#lib/text/ansi";

export default class Logger extends Console {
    #colorMode;
    #console;

    constructor ( { stdout, stderr, colorMode } = {} ) {
        super( {
            "stdout": stdout || process.stdout,
            "stderr": stderr || process.stderr,
            "colorMode": colorMode || "auto",
            "ignoreErrors": true,
        } );

        this.#colorMode = colorMode || true;
    }

    // properties
    get colorMode () {
        return this.#colorMode;
    }

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
        super.debug( this.#colorMode ? ansi.dim( "[D]" ) : "[D]", ...args );
    }

    info ( ...args ) {
        super.info( this.#colorMode ? ansi.ok( "[I]" ) : "[I]", ...args );
    }

    warn ( ...args ) {
        super.warn( this.#colorMode ? ansi.warn( "[W]" ) : "[W]", ...args );
    }

    error ( ...args ) {
        super.error( this.#colorMode ? ansi.error( "[E]" ) : "[E]", ...args );
    }
}
