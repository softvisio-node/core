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

        this.#onShutdownListener = graceful => this.emit( "shutdown", graceful );

        controller.on( "shutdown", this.#onShutdownListener );
    }

    // properties
    get name () {
        return this.#name;
    }

    get isShutdown () {
        return this.#controller.isShutdown;
    }

    get isGracefulShutdown () {
        return this.#controller.isGracefulShutdown;
    }

    get isDone () {
        return this.#isDone();
    }

    // public
    done () {
        if ( this.#isDone ) return;

        this.#isDone = true;

        this.#controller.off( "shutdown", this.#onShutdownListener );

        this.#onShutdownListener = null;

        this.emit( "done" );
    }

    on ( name, listener ) {
        super.on( name, listener );

        if ( name === "shutdown" && this.isShutdown ) {
            listener( this.isGracefulShutdown );
        }

        return this;
    }

    once ( name, listener ) {
        if ( name === "shutdown" && this.isShutdown ) {
            listener( this.isGracefulShutdown );
        }
        else {
            super.once( name, listener );
        }

        return this;
    }
}

class ShutdownController extends Events {
    #isShutdown = false;
    #isGracefulShutdown = false;
    #shutdownTimeout = 60000;
    #shutdownTimer;
    #signals = new Set();

    constructor () {
        super();

        process.on( "beforeExit", this.#onProcessBeforeExit.bind( this ) );

        process.once( "exit", this.#onProcessExit.bind( this ) );

        process.on( "SIGINT", this.#onProcessSignal.bind( this ) );

        process.on( "SIGTERM", this.#onProcessSignal.bind( this ) );
    }

    // properties
    get isShutdown () {
        return this.#isShutdown;
    }

    get isGracefulShutdown () {
        return this.#isGracefulShutdown;
    }

    // public
    shutdown ( code ) {
        if ( this.#isShutdown && !this.#isGracefulShutdown ) return;

        this.#isShutdown = true;
        this.#isGracefulShutdown = false;

        console.log( `Process shutdown started` );

        if ( code != null ) process.exitCode = code;

        this.#checkSignals();

        clearTimeout( this.#shutdownTimer );
        this.#shutdownTimer = setTimeout( this.#onShutdownTimeout.bind( this ), this.#shutdownTimeout );

        this.emit( "shutdown", false );
    }

    gracefulShutdown ( code ) {
        if ( this.#isShutdown ) return;

        this.#isShutdown = true;
        this.#isGracefulShutdown = true;

        console.log( `Process graceful shutdown started` );

        if ( code != null ) process.exitCode = code;

        this.#checkSignals();

        clearTimeout( this.#shutdownTimer );
        this.#shutdownTimer = setTimeout( this.#onGracefulShutdownTimeout.bind( this ), this.#shutdownTimeout );

        this.emit( "shutdown", true );
    }

    signal ( name ) {
        const signal = new ShutdownSignal( this, name );

        signal.once( "done", this.#onSignalDone.bind( this, signal ) );

        this.#signals.add( signal );

        return signal;
    }

    // private
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

    #onShutdownTimeout () {
        console.log( `Process shutdown timeout reached` );

        this.#exitProcess();
    }

    #onGracefulShutdownTimeout () {
        console.log( `Process graceful shutdown timeout reached` );

        this.#exitProcess();
    }

    #checkSignals () {
        if ( !this.#isShutdown ) return;

        if ( !this.#signals.size ) this.#exitProcess();
    }

    #onSignalDone ( signal ) {
        if ( !this.#signals.has( signal ) ) return;

        this.#signals.delete( signal );

        if ( this.#isShutdown ) {

            // console.log( `Process component gracefully exited: ${signal.name}` );

            this.#checkSignals();
        }
    }

    #exitProcess () {
        process.exit();
    }

    #onProcessBeforeExit ( code ) {}

    #onProcessExit ( code ) {
        if ( this.#signals.size ) {
            for ( const signal of this.#signals ) console.log( `Process component forcibly terminated: ${signal.name}` );
        }

        console.log( `Process exited with code: ${code}` );
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
