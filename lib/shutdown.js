import Events from "#lib/events";
import Locale from "#lib/locale";

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
    #isGracefulShuttingDown = false;
    #isShuttingDown = false;
    #shutdownTimer;
    #signals = new Map();
    #finalization = new FinalizationRegistry( id => this.#onSignalDone.bind( this, true ) );
    #locale;

    constructor () {
        process.once( "exit", this.#onProcessExit.bind( this ) );

        process.on( "SIGINT", this.#onProcessSignal.bind( this ) );

        process.on( "SIGTERM", this.#onProcessSignal.bind( this ) );
    }

    // properties
    get isGracefulShuttingDown () {
        return this.#isGracefulShuttingDown;
    }

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    // public
    gracefulShutDown ( { code, timeout } = {} ) {
        if ( this.#isShuttingDown ) return;

        this.#isShuttingDown = true;
        this.#isGracefulShuttingDown = true;

        console.log( `Process is gracefully shutting down` );

        if ( code != null ) process.exitCode = code;

        this.#checkSignals();

        clearTimeout( this.#shutdownTimer );

        if ( timeout ) {
            console.log( `Process will be forcibly terminate ${( this.#locale ||= new Locale() ).formatRelativeTime( timeout )} seconds` );

            this.#shutdownTimer = setTimeout( this.#onGracefulShutdownTimeout.bind( this ), timeout );
        }

        this.#events.emit( "gracefulShutdown" );
        this.#events.emit( "shutdown", true );
    }

    shutDown ( { code, timeout } = {} ) {
        if ( this.#isShuttingDown && !this.#isGracefulShuttingDown ) return;

        this.#isShuttingDown = true;
        this.#isGracefulShuttingDown = false;

        console.log( `Process is shutting down` );

        if ( code != null ) process.exitCode = code;

        this.#checkSignals();

        clearTimeout( this.#shutdownTimer );

        if ( timeout ) {
            console.log( `Process will be forcibly terminate ${( this.#locale ||= new Locale() ).formatRelativeTime( timeout )} seconds` );

            this.#shutdownTimer = setTimeout( this.#onShutdownTimeout.bind( this ), timeout );
        }

        this.#events.emit( "shutdown", false );

        this.#events.removeAllListeners( "shutdown" );
    }

    signal ( name ) {
        const id = {};

        name ||= "unknown";

        const signal = new ShutdownSignal( this, name, this.#onSignalDone.bind( this, false, id ) );

        this.#finalization.register( signal, id, id );

        this.#signals.set( id, name );

        return signal;
    }

    on ( name, listener ) {
        if ( name === "gracefulShutdown" ) {
            if ( this.#isGracefulShuttingDown ) {
                listener();
            }
            else if ( !this.#isShuttingDown ) {
                this.#events.once( name, listener );
            }
        }
        else if ( name === "shutdown" ) {
            if ( this.#isGracefulShuttingDown ) {
                listener( true );

                this.#events.once( name, listener );
            }
            else if ( this.#isShuttingDown ) {
                listener( false );
            }
            else {
                this.#events.on( name, listener );
            }
        }
        else {
            this.#events.on( name, listener );
        }

        return this;
    }

    once ( name, listener ) {
        if ( name === "gracefulShutdown" ) {
            if ( this.#isGracefulShuttingDown ) {
                listener();
            }
            else if ( !this.#isShuttingDown ) {
                this.#events.once( name, listener );
            }
        }
        else if ( name === "shutdown" ) {
            if ( this.#isGracefulShuttingDown ) {
                listener( true );

                this.#events.once( name, listener );
            }
            else if ( this.#isShuttingDown ) {
                listener( false );
            }
            else {
                this.#events.once( name, listener );
            }
        }
        else {
            this.#events.once( name, listener );
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

            this.shutDown();
        }
        else if ( signal === "SIGTERM" ) {
            console.log( `Process ${signal} received` );

            this.gracefulShutDown();
        }
    }

    #onGracefulShutdownTimeout () {
        console.log( `Process graceful shutdown timeout reached` );

        this.#exitProcess();
    }

    #onShutdownTimeout () {
        console.log( `Process shutdown timeout reached` );

        this.#exitProcess();
    }

    #checkSignals () {
        if ( !this.#isShuttingDown ) return;

        if ( !this.#signals.size ) this.#exitProcess();
    }

    #onSignalDone ( finalization, id ) {
        if ( !this.#signals.has( id ) ) return;

        if ( !finalization ) this.#finalization.unregister( id );

        // const name = this.#signals.get( id );

        this.#signals.delete( id );

        if ( this.#isShuttingDown ) {

            // console.log( `Process component gracefully exited: ${name}` );

            this.#checkSignals();
        }
    }

    #exitProcess () {
        process.exit();
    }

    #onProcessExit ( code ) {
        if ( this.#signals.size ) {
            for ( const name of this.#signals.values() ) {
                console.log( `Process component forcibly terminated: ${name}` );
            }
        }

        console.log( `Process exited with the code: ${code}` );
    }
}

const shutdownController = new ShutdownController();

export default shutdownController;

// register globally
if ( !( global.shutdown instanceof ShutdownController ) ) {
    Object.defineProperty( process, "shutdownController", {
        "configurable": false,
        "writable": false,
        "enumerable": true,
        "value": shutdownController,
    } );
}
