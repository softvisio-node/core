import Events from "#lib/events";
import Locale from "#lib/locale";

class ShutdownSignal {
    #controller;
    #name;
    #lock;
    #unlock;
    #isLocked = false;

    constructor ( { controller, name, lock, unlock } ) {
        this.#controller = controller;
        this.#name = name;
        this.#lock = lock;
        this.#unlock = unlock;
    }

    // properties
    get name () {
        return this.#name;
    }

    get isLocked () {
        return this.#isLocked;
    }

    // public
    lock () {
        return this.#lock();
    }

    unlock () {
        return this.#unlock();
    }
}

class ShutdownController {
    #events = new Events();
    #isShuttingDown = false;
    #shutdownTimer;
    #finalization = new FinalizationRegistry( id => this.#onSignalDeleted.bind( this ) );
    #locale;
    #sigIntCount = 0;
    #signals = new Map();
    #locksCount = 0;

    constructor () {
        process.once( "exit", this.#onProcessExit.bind( this ) );

        process.on( "SIGINT", this.#onProcessSignal.bind( this ) );

        process.on( "SIGTERM", this.#onProcessSignal.bind( this ) );
    }

    // properties
    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    // public
    shutDown ( { code, timeout } = {} ) {
        if ( this.#isShuttingDown ) return;

        this.#isShuttingDown = true;

        console.log( `Process is shutting down` );

        if ( code != null ) process.exitCode = code;

        this.#checkSignals();

        clearTimeout( this.#shutdownTimer );

        if ( timeout ) {
            console.log( `Process will be forcibly terminate ${( this.#locale ||= new Locale() ).formatRelativeTime( timeout )} seconds` );

            this.#shutdownTimer = setTimeout( this.#onShutdownTimeout.bind( this ), timeout );
        }

        this.#events.emit( "shutdown" );

        this.#events.removeAllListeners( "shutdown" );
    }

    newSignal ( name ) {
        const id = {};

        name ||= "unknown";

        const signal = new ShutdownSignal( {
            "controller": this,
            name,
            "lock": this.#onSignalLock.bind( this, id ),
            "unlock": this.#onSignalUnlock.bind( this, id ),
        } );

        this.#finalization.register( signal, id, id );

        this.#signals.set( id, {
            name,
            "locked": false,
        } );

        return signal;
    }

    on ( name, listener ) {
        if ( name === "shutdown" ) {
            if ( this.#isShuttingDown ) {
                listener();
            }
            else {
                this.#events.once( name, listener );
            }
        }
        else {
            this.#events.on( name, listener );
        }

        return this;
    }

    once ( name, listener ) {
        if ( name === "shutdown" ) {
            if ( this.#isShuttingDown ) {
                listener();
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
            console.log( `${signal} received` );

            this.#sigIntCount++;

            if ( this.#sigIntCount === 1 ) {
                console.log( `To forcibly terminate the process send SIGINT once more` );

                this.shutDown();
            }
            else {
                this.#exitProcess();
            }
        }
        else if ( signal === "SIGTERM" ) {
            console.log( `${signal} received` );

            this.shutDown();
        }
    }

    #onShutdownTimeout () {
        console.log( `Process shutdown timeout reached` );

        this.#exitProcess();
    }

    #checkSignals () {
        if ( !this.#isShuttingDown ) return;

        if ( !this.#locksCount ) this.#exitProcess();
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

    #onSignalLock ( id ) {
        if ( this.#isShuttingDown ) return false;

        const signal = this.#signals.get( id );

        if ( !signal ) return false;

        if ( !signal.locked ) {
            signal.locked = true;

            this.#locksCount++;
        }

        return true;
    }

    #onSignalUnlock ( id ) {
        const signal = this.#signals.get( id );

        if ( !signal ) return false;

        if ( signal.locked ) {
            signal.locked = false;

            this.#locksCount--;

            if ( this.#isShuttingDown ) this.#checkSignals();
        }

        return true;
    }

    #onSignalDeleted ( id ) {
        const signal = this.#signals.get( id );

        if ( !signal ) return;

        if ( signal.locked ) {
            this.#onSignalUnlock( id );
        }

        this.#signals.delete( id );
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
