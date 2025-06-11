import { Console } from "node:console";
import ansi from "#lib/ansi";

export default class Logger extends Console {
    #stdoutColorMode;
    #stderrColorMode;
    #console;

    constructor ( { stdout, stderr, colorMode } = {} ) {
        colorMode ??= "auto";

        super( {
            "stdout": stdout || process.stdout,
            "stderr": stderr || process.stderr,
            colorMode,
            "ignoreErrors": true,
        } );

        if ( colorMode === "auto" ) {
            this.#stdoutColorMode = this._stdout?.isTTY;
            this.#stderrColorMode = this._stderr?.isTTY;
        }
        else {
            this.#stdoutColorMode = colorMode;
            this.#stderrColorMode = colorMode;
        }
    }

    // properties
    get console () {
        return this.#console || global.console;
    }

    // public
    installGlobalConsole () {
        if ( !this.#console ) {
            this.#console = global.console;

            global.console = this;
        }

        return this;
    }

    restoreGlobalConsole () {
        if ( this.#console ) {
            global.console = this.#console;

            this.#console = null;
        }

        return this;
    }

    write ( ...args ) {
        this._stdout.write( args.join( " " ) );
    }

    debug ( ...args ) {
        super.debug( this.#stdoutColorMode
            ? ansi.dim( "[D]" )
            : "[D]", ...args );
    }

    info ( ...args ) {
        super.info( this.#stdoutColorMode
            ? ansi.ok( "[I]" )
            : "[I]", ...args );
    }

    warn ( ...args ) {
        super.warn( this.#stderrColorMode
            ? ansi.warn( "[W]" )
            : "[W]", ...args );
    }

    error ( ...args ) {
        super.error( this.#stderrColorMode
            ? ansi.error( "[E]" )
            : "[E]", ...args );
    }
}
