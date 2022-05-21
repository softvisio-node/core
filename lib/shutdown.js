class ShutdownController {
    #isShutdown = false;
    #gracefulShutdownTimeout = 60000;

    constructor () {
        process.on( "beforeExit", this.#onBeforeExit.bind( this ) );

        process.on( "exit", this.#onExit.bind( this ) );

        process.on( "SIGINT", this.#onSignal.bind( this ) );

        process.on( "SIGTERM", this.#onSignal.bind( this ) );
    }

    // properties
    isShutdown () {
        return this.#isShutdown;
    }

    // public
    shutdown () {
        this.#isShutdown = true;

        process.exit( 0 );
    }

    gracefulShutdown () {
        if ( this.#isShutdown ) return;

        this.#isShutdown = true;

        console.log( `Process graceful shutdown started` );

        setTimeout( this.#onGracefulShutdownTimeout.bind( this ), this.#gracefulShutdownTimeout );
    }

    // provate
    #onBeforeExit ( code ) {}

    #onExit ( code ) {
        console.log( `Process terminated with code: ${code}` );
    }

    #onSignal ( signal ) {
        if ( signal === "SIGINT" ) {
            console.log( `Process SIGINT received` );

            this.shutdown();
        }
        else if ( signal === "SIGTERM" ) {
            console.log( `Process SIGTERM received` );

            this.gracefulShutdown();
        }
    }

    #onGracefulShutdownTimeout () {
        console.log( `Process graceful shutdown timeout reached` );

        this.shutdown();
    }
}

const shutdown = new ShutdownController();

export default shutdown;

// register globally
if ( !( global.shutdown instanceof ShutdownController ) ) {
    Object.defineProperty( global, "shutdown", {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        "value": shutdown,
    } );
}
