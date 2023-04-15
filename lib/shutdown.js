import Events from "#lib/events";

const DEFAULT_SHUTDOWN_TIMEOUT = 60_000;

class ShutdownSignal {
    #controller;
    #name;
    #isDone = false;
    #onDone;

    constructor ( controller, name, onDone ) {
        this.#controller = controller;
        this.#name = name;
        this.#onDone = onDone;
    }

    // properties
    get name () {
        return this.#name;
    }

    get isDone () {
        return this.#isDone();
    }

    // public
    done () {
        if ( this.#isDone ) return;

        this.#isDone = true;

        this.#onDone();

        this.#onDone = null;
    }
}

class ShutdownController {
    #events = new Events();
    #isGracefulExiting = false;
    #isExiting = false;
    #shutdownTimer;
    #signals = new Map();
    #finalization = new FinalizationRegistry( id => this.#onSignalDone.bind( this, true ) );

    constructor () {
        process.on( "beforeExit", this.#onProcessBeforeExit.bind( this ) );

        process.once( "exit", this.#onProcessExit.bind( this ) );

        process.on( "SIGINT", this.#onProcessSignal.bind( this ) );

        process.on( "SIGTERM", this.#onProcessSignal.bind( this ) );
    }

    // properties
    get isExitsGracefully () {
        return this.#isGracefulExiting;
    }

    get isExits () {
        return this.#isExiting;
    }

    // public
    gracefulShutdown ( code ) {
        if ( this.#isExiting ) return;

        this.#isExiting = true;
        this.#isGracefulExiting = true;

        console.log( `Process graceful shutdown started` );

        if ( code != null ) process.exitCode = code;

        this.#checkSignals();

        clearTimeout( this.#shutdownTimer );
        this.#shutdownTimer = setTimeout( this.#onGracefulShutdownTimeout.bind( this ), DEFAULT_SHUTDOWN_TIMEOUT );

        this.#events.emit( "shutdown", true );
    }

    shutdown ( code ) {
        if ( this.#isExiting && !this.#isGracefulExiting ) return;

        this.#isExiting = true;
        this.#isGracefulExiting = false;

        console.log( `Process shutdown started` );

        if ( code != null ) process.exitCode = code;

        this.#checkSignals();

        clearTimeout( this.#shutdownTimer );
        this.#shutdownTimer = setTimeout( this.#onShutdownTimeout.bind( this ), DEFAULT_SHUTDOWN_TIMEOUT );

        this.#events.emit( "shutdown", false );
    }

    signal ( name ) {
        const id = {};

        const signal = new ShutdownSignal( this, name, this.#onSignalDone.bind( this, false, id ) );

        this.#finalization.register( signal, id, id );

        this.#signals.set( id, name );

        return signal;
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

    off ( name, listener ) {
        this.#events.off( name, listener );

        return this;
    }

    // private
    #onProcessSignal ( signal ) {
        if ( signal === "SIGINT" ) {
            console.log( `Process ${signal} received` );

            this.shutdown();
        }
        else if ( signal === "SIGTERM" ) {
            console.log( `Process ${signal} received` );

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
        if ( !this.#isExiting ) return;

        if ( !this.#signals.size ) this.#exitProcess();
    }

    #onSignalDone ( finalization, id ) {
        if ( !this.#signals.has( id ) ) return;

        if ( !finalization ) this.#finalization.unregister( id );

        // const name = this.#signals.get( id );

        this.#signals.delete( id );

        if ( this.#isExiting ) {

            // console.log( `Process component gracefully exited: ${name}` );

            this.#checkSignals();
        }
    }

    #exitProcess () {
        process.exit();
    }

    #onProcessBeforeExit ( code ) {}

    #onProcessExit ( code ) {
        if ( this.#signals.size ) {
            for ( const name of this.#signals.values() ) {
                console.log( `Process component forcibly terminated: ${name}` );
            }
        }

        console.log( `Process exited with the code: ${code}` );
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
