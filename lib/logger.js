import ansi from "#lib/text/ansi";

class Console {
    #info = global.console.info;
    #warn = global.console.warn;
    #error = global.console.error;

    // properties
    get info () {
        return this.#info;
    }

    get warn () {
        return this.#warn;
    }

    get error () {
        return this.#error;
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
        global.console.info = this.info.bind( this );

        global.console.warn = this.warn.bind( this );

        global.console.error = this.error.bind( this );
    }

    uninstall () {
        global.console.info = console.info;

        global.console.warn = console.warn;

        global.console.error = console.error;
    }

    write ( ...args ) {
        global.console.stdout.write( args.join( " " ) );
    }

    log ( ...args ) {
        this.console.info( ...args );
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
