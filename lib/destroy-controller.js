import { isMainThread } from "node:worker_threads";
import Events from "#lib/events";
import Locale from "#lib/locale";

class DestroyLock {
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

class DestroyController {
    #events = new Events();
    #isDestroying = false;
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
    get isDestroying () {
        return this.#isDestroying;
    }

    // public
    destroy ( { code, timeout } = {} ) {
        if ( this.#isDestroying ) return;

        this.#isDestroying = true;

        if ( code != null ) process.exitCode = code;

        if ( isMainThread ) {
            console.info( "Process is destroying" );
        }
        else {
            console.log( "Thread is destroying" );
        }

        if ( timeout ) {
            console.log( `Process will be forcibly terminate ${ ( this.#locale ||= new Locale() ).formatRelativeDate( timeout ) } seconds` );

            setTimeout( this.#onDestroyTimeout.bind( this ), timeout );
        }

        this.#events.emit( "destroy" );

        this.#checkLocks();
    }

    lock ( name ) {
        const id = {};

        name ||= "unknown";

        const lock = new DestroyLock( {
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
            if ( this.#isDestroying ) {
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
            if ( this.#isDestroying ) {
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
                console.log( "To forcibly terminate the process send SIGINT once more" );

                this.destroy();
            }
            else {
                this.#exitProcess();
            }
        }
        else if ( signal === "SIGTERM" ) {
            console.log( `${ signal } received` );

            this.destroy();
        }
    }

    #onDestroyTimeout () {
        console.log( "Process destroy timeout reached" );

        this.#exitProcess();
    }

    #checkLocks () {
        if ( !this.#isDestroying ) return;

        if ( !this.#locks.size ) this.#exitProcess();
    }

    #exitProcess () {
        process.exit();
    }

    #onProcessExit ( code ) {
        if ( this.#locks.size ) {
            for ( const lock of this.#locks.values() ) {
                console.log( `Process destroy lock forcibly terminated: ${ lock.name }` );
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

const destroyController = new DestroyController();

export default destroyController;

process.on( "uncaughtException", e => {
    if ( !( e instanceof Error ) ) e = new Error( e );

    console.error( e );

    destroyController.destroy( { "code": 1 } );
} );

// register globally
if ( !process.destroyController ) {
    Object.defineProperties( process, {
        "destroyController": {
            "configurable": false,
            "writable": false,
            "enumerable": true,
            "value": destroyController,
        },
        "isDestroying": {
            "configurable": false,
            "enumerable": false,
            get () {
                return destroyController.isDestroying;
            },
        },
        "destroy": {
            "configurable": false,
            "writable": false,
            "enumerable": false,
            "value": destroyController.destroy.bind( destroyController ),
        },
    } );
}
