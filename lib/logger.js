import ansi from "#lib/text/ansi";

class Console {
    #log = global.console.log;
    #debug = global.console.debug;
    #info = global.console.info;
    #warn = global.console.warn;
    #error = global.console.error;

    // properties
    get log () {
        return this.#log;
    }

    get debug () {
        return this.#debug;
    }

    get info () {
        return this.#info;
    }

    get warn () {
        return this.#warn;
    }

    get error () {
        return this.#error;
    }

    // public
    restore () {
        global.console.log = this.#log;

        global.console.debug = this.#debug;

        global.console.info = this.#info;

        global.console.warn = this.#warn;

        global.console.error = this.#error;
    }
}

const console = new Console();

export class Logger {

    // properties
    get console () {
        return console;
    }

    // public
    install () {
        global.console.log = this.log.bind( this );

        global.console.debug = this.debug.bind( this );

        global.console.info = this.info.bind( this );

        global.console.warn = this.warn.bind( this );

        global.console.error = this.error.bind( this );
    }

    uninstall () {
        console.restore();
    }

    // XXX
    write ( ...args ) {
        process.stdout.write( args.join( " " ) );
    }

    log ( ...args ) {
        this.console.log( ...args );
    }

    debug ( ...args ) {
        this.console.debug( ansi.dim( "[D]" ), ...args );
    }

    info ( ...args ) {
        this.console.info( ansi.ok( "[I]" ), ...args );
    }

    warn ( ...args ) {
        this.console.warn( ansi.warn( "[W]" ), ...args );
    }

    error ( ...args ) {
        this.console.error( ansi.error( "[E]" ), ...args );
    }
}

export default new Logger();
