import Events from "#lib/events";

const DEFAULT_SHUTDOWN_TIMEOUT = 60_000;

class ShutdownSignal {
    #controller;
    #name;
    #events = new Events();
    #isDone = false;
    #onShutdownListener;

    constructor ( controller, name ) {
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
        if ( name === "shutdown" ) {
            this.#controller.on( name, listener );
        }
        else if ( name === "done" ) {
            if ( this.#isDone ) listener();

            this.#events.on( name, listener );
        }

        return this;
    }

    once ( name, listener ) {
        if ( name === "shutdown" ) {
            this.#controller.once( name, listener );
        }
        else if ( name === "done" ) {
            if ( this.#isDone ) {
                listener();
            }
            else {
                this.#events.once( name, listener );
            }
        }

        return this;
    }

    off ( name, listener ) {
        if ( name === "shutdown" ) {
            this.#controller.off( name, listener );
        }
        else {
            this.#events.off( name, listener );
        }

        return this;
    }
}

class ShutdownController extends Events {
    #isShutdown = false;
    #isGracefulShutdown = false;
    #shutdownTimer;
    #signals = new Map();
    #finalization = new FinalizationRegistry( id => this.#onSignalDone.bind( this ) );

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
    gracefulShutdown ( code ) {
        if ( this.#isShutdown ) return;

        this.#isShutdown = true;
        this.#isGracefulShutdown = true;

        console.log( `Process graceful shutdown started` );

        if ( code != null ) process.exitCode = code;

        this.#checkSignals();

        clearTimeout( this.#shutdownTimer );
        this.#shutdownTimer = setTimeout( this.#onGracefulShutdownTimeout.bind( this ), DEFAULT_SHUTDOWN_TIMEOUT );

        this.emit( "shutdown", true );
    }

    shutdown ( code ) {
        if ( this.#isShutdown && !this.#isGracefulShutdown ) return;

        this.#isShutdown = true;
        this.#isGracefulShutdown = false;

        console.log( `Process shutdown started` );

        if ( code != null ) process.exitCode = code;

        this.#checkSignals();

        clearTimeout( this.#shutdownTimer );
        this.#shutdownTimer = setTimeout( this.#onShutdownTimeout.bind( this ), DEFAULT_SHUTDOWN_TIMEOUT );

        this.emit( "shutdown", false );
    }

    signal ( name ) {
        const id = Symbol();

        const signal = new ShutdownSignal( this, name );

        signal.once( "done", this.#onSignalDone.bind( this, id ) );

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
        if ( !this.#isShutdown ) return;

        if ( !this.#signals.size ) this.#exitProcess();
    }

    #onSignalDone ( id ) {
        if ( !this.#signals.has( id ) ) return;

        this.#finalization.unregister( id );

        // const name = this.#signals.get( id );

        this.#signals.delete( id );

        if ( this.#isShutdown ) {

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
