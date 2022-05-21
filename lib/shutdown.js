import Events from "#lib/events";

class ShutdownSignal extends Events {
    #controller;
    #name;
    #isDone = false;
    #onShutdownListener;

    constructor ( controller, name ) {
        super();

        this.#controller = controller;
        this.#name = name;

        this.#onShutdownListener = () => {
            this.#onShutdownListener = null;

            this.emit( "shutdown" );
        };

        controller.once( "shutdown", this.#onShutdownListener );
    }

    // properties
    get name () {
        return this.#name;
    }

    get isShutdown () {
        return this.#controller.isShutdown;
    }

    get isDone () {
        return this.#isDone();
    }

    // public
    done () {
        if ( this.#isDone ) return;

        this.#isDone = true;

        if ( this.#onShutdownListener ) this.#controller.off( "shutdown", this.#onShutdownListener );

        this.emit( "done" );
    }

    on ( name, listener ) {
        if ( name === "shutdows" && this.#controller.isShutdown ) {
            listener();
        }
        else {
            super.on( name, listener );
        }
    }

    once ( name, listener ) {
        if ( name === "shutdows" && this.#controller.isShutdown ) {
            listener();
        }
        else {
            super.once( name, listener );
        }
    }
}

class ShutdownController extends Events {
    #isShutdown = false;
    #gracefulShutdownTimeout = 60000;
    #signals = new Set();

    constructor () {
        super();

        process.on( "beforeExit", this.#onProcessBeforeExit.bind( this ) );

        process.once( "exit", this.#onProcessExit.bind( this ) );

        process.on( "SIGINT", this.#onProcessSignal.bind( this ) );

        process.on( "SIGTERM", this.#onProcessSignal.bind( this ) );
    }

    // properties
    isShutdown () {
        return this.#isShutdown;
    }

    // public
    shutdown ( code ) {
        this.#isShutdown = true;

        if ( code != null ) process.exitCode = code;

        process.exit();
    }

    gracefulShutdown ( code ) {
        if ( this.#isShutdown ) return;

        this.#isShutdown = true;

        if ( code != null ) process.exitCode = code;

        console.log( `Process graceful shutdown started` );

        setTimeout( this.#onGracefulShutdownTimeout.bind( this ), this.#gracefulShutdownTimeout );

        this.#checkSignals();

        this.emit( "shutdown" );
    }

    signal ( name ) {
        const signal = new ShutdownSignal( this, name );

        signal.once( "done", this.#onSignalDone.bind( this, signal ) );

        this.#signals.add( signal );

        return signal;
    }

    // provate
    #onProcessBeforeExit ( code ) {}

    #onProcessExit ( code ) {
        if ( this.#signals.size ) {
            for ( const signal of this.#signals ) console.log( `Process component forcibly terminated: ${signal.name}` );
        }

        console.log( `Process terminated with code: ${code}` );
    }

    #onProcessSignal ( signal ) {
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

    #checkSignals () {
        if ( !this.#isShutdown ) return;

        if ( !this.#signals.size ) this.shutdown();
    }

    #onSignalDone ( signal ) {
        if ( !this.#signals.has( signal ) ) return;

        this.#signals.delete( signal );

        if ( this.#isShutdown ) {
            console.log( `Process component gracefully exited: ${signal.name}` );

            this.#checkSignals();
        }
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
