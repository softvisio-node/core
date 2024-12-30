import { isMainThread } from "node:worker_threads";
import Events from "#lib/events";
import Locale from "#lib/locale";

class destroyLock {
    #name;
    #done;
    #isDone = false;

    constructor ( { name, done } ) {
        this.#name = name;
        this.#done = done;
    }

    // properties
    get name () {
        return this.#name;
    }

    get isDone () {
        return this.#isDone;
    }

    // public
    done () {
        if ( this.#isDone ) return;

        this.#isDone = true;

        this.#done();

        this.#done = null;
    }
}

class ShutdownController {
    #events = new Events();
    #isShuttingDown = false;
    #finalization;
    #locale;
    #sigIntCount = 0;
    #locks = new Map();

    constructor () {
        this.#finalization = new FinalizationRegistry( this.#onLockDone.bind( this, true ) );

        process.once( "exit", this.#onProcessExit.bind( this ) );

        if ( isMainThread ) {
            process.on( "SIGINT", this.#onProcessSignal.bind( this ) );

            process.on( "SIGTERM", this.#onProcessSignal.bind( this ) );
        }
    }

    // properties
    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    // public
    shutDown ( { code, timeout } = {} ) {
        if ( this.#isShuttingDown ) return;

        this.#isShuttingDown = true;

        if ( code != null ) process.exitCode = code;

        if ( isMainThread ) {
            console.info( `Process is shutting down` );
        }
        else {
            console.log( `Thread is shutting down` );
        }

        if ( timeout ) {
            console.log( `Process will be forcibly terminate ${ ( this.#locale ||= new Locale() ).formatRelativeDate( timeout ) } seconds` );

            setTimeout( this.#onShutdownTimeout.bind( this ), timeout );
        }

        this.#events.emit( "destroy" );

        this.#checkLocks();
    }

    lock ( name ) {
        const id = {};

        name ||= "unknown";

        const lock = new destroyLock( {
            name,
            "done": this.#onLockDone.bind( this, false, id ),
        } );

        this.#finalization.register( lock, id, id );

        this.#locks.set( id, {
            name,
        } );

        return lock;
    }

    on ( name, listener ) {
        if ( name === "destroy" ) {
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
        if ( name === "destroy" ) {
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
            console.log( `${ signal } received` );

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
            console.log( `${ signal } received` );

            this.shutDown();
        }
    }

    #onShutdownTimeout () {
        console.log( `Process shutdown timeout reached` );

        this.#exitProcess();
    }

    #checkLocks () {
        if ( !this.#isShuttingDown ) return;

        if ( !this.#locks.size ) this.#exitProcess();
    }

    #exitProcess () {
        process.exit();
    }

    #onProcessExit ( code ) {
        if ( this.#locks.size ) {
            for ( const lock of this.#locks.values() ) {
                console.log( `Process shutdown lock forcibly terminated: ${ lock.name }` );
            }
        }

        console.info( `Process exited with the code: ${ code }` );
    }

    #onLockDone ( finalization, id ) {
        if ( !finalization ) this.#finalization.unregister( id );

        this.#locks.delete( id );

        this.#checkLocks();
    }
}

const shutdownController = new ShutdownController();

export default shutdownController;

process.on( "uncaughtException", e => {
    if ( !( e instanceof Error ) ) e = new Error( e );

    console.log( e );

    shutdownController.shutDown( { "code": 1 } );
} );

// register globally
if ( !process.shutdown ) {
    Object.defineProperties( process, {
        "shutdown": {
            "configurable": false,
            "writable": false,
            "enumerable": true,
            "value": shutdownController,
        },
        "isShuttingDown": {
            "configurable": false,
            "enumerable": false,
            get () {
                return shutdownController.isShuttingDown;
            },
        },
        "shutDown": {
            "configurable": false,
            "writable": false,
            "enumerable": false,
            "value": shutdownController.shutDown.bind( shutdownController ),
        },
    } );
}
