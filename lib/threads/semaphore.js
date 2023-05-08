import "#lib/result";
import Set from "#lib/threads/set";
import Events from "#lib/events";
import Deque from "#lib/data/deque";
import Signal from "#lib/threads/signal";

const DEFAULT_MAX_THREADS = 1,
    DEFAULT_MAX_WAITING_THREADS = Infinity;

class SemaphoreSet extends Set {

    // protected
    _createTarget ( id, options = {} ) {
        const target = new Semaphore( { ...options, id } );

        target.on( "finish", this._destroyTarget.bind( this, id ) );

        return target;
    }

    _isTargetDestroyable ( target ) {
        return target.isFinished;
    }
}

export default class Semaphore {
    #id;
    #maxThreads;
    #maxWaitingThreads;
    #runningThreads = 0;
    #waitingThreads = new Deque();
    #isShuttingDown = false;
    #shutdownSignal;
    #_events;

    constructor ( { id, maxThreads, maxWaitingThreads } = {} ) {
        this.#id = id;
        this.#setMaxThreads( maxThreads ?? DEFAULT_MAX_THREADS );
        this.maxWaitingThreads = maxWaitingThreads ?? DEFAULT_MAX_WAITING_THREADS;
    }

    // static
    static get Set () {
        return SemaphoreSet;
    }

    // properties
    get id () {
        return this.#id;
    }

    get maxThreads () {
        return this.#maxThreads;
    }

    set maxThreads ( value ) {
        const oldValue = this.#maxThreads;

        this.#setMaxThreads( value );

        if ( this.#maxThreads > oldValue ) {
            this.#runWaitingThreads();
        }
    }

    get maxWaitingThreads () {
        return this.#maxWaitingThreads;
    }

    set maxWaitingThreads ( value ) {
        if ( value !== Infinity ) {
            if ( value !== Infinity && ( !Number.isInteger( value ) || value < 0 ) ) throw TypeError( `Semaphore maxWaitingThreads value must be integer >= 0 or Infinity` );
        }

        this.#maxWaitingThreads = value;
    }

    get runningThreads () {
        return this.#runningThreads;
    }

    get freeThreads () {
        if ( this.#isShuttingDown ) return 0;

        const freeThreads = this.#maxThreads - this.#runningThreads;

        return freeThreads < 0 ? 0 : freeThreads;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    get freeWaitingThreads () {
        if ( this.#isShuttingDown ) return 0;

        const freeWaitingThreads = this.#maxWaitingThreads - this.waitingThreads;

        return freeWaitingThreads < 0 ? 0 : freeWaitingThreads;
    }

    get totalFreeThreads () {
        return this.freeThreads + this.freeWaitingThreads;
    }

    get isFinished () {
        return !this.#runningThreads && !this.waitingThreads;
    }

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    get stats () {
        return {
            "maxThreads": this.maxThreads,
            "maxWaitingThreads": this.maxWaitingThreads,
            "runningThreads": this.runningThreads,
            "freeThreads": this.freeThreads,
            "waitingThreads": this.waitingThreads,
            "freeWaitingThreads": this.freeWaitingThreads,
            "totalFreeThreads": this.totalFreeThreads,
        };
    }

    // public
    async runThread ( method, ...args ) {
        return this.#runThread( method, args, false );
    }

    async unshiftThread ( method, ...args ) {
        return this.#runThread( method, args, true );
    }

    tryDown () {
        if ( this.freeThreads ) {
            this.#runningThreads++;

            return true;
        }
        else {
            return false;
        }
    }

    async down ( unshift ) {
        if ( this.freeThreads ) {
            this.#runningThreads++;
        }
        else {
            if ( unshift ) {
                return new Promise( resolve => this.#waitingThreads.unshift( resolve ) );
            }
            else {
                return new Promise( resolve => this.#waitingThreads.push( resolve ) );
            }
        }
    }

    up () {
        if ( !this.#runningThreads ) throw Error( `Semaphore running threads value can't be < 0` );

        this.#runningThreads--;

        this.#runWaitingThreads();

        return this;
    }

    // XXX whet to do, if maxThreads = 0 or semaphore is paused
    async shutDown () {
        if ( !this.#isShuttingDown ) {
            this.#isShuttingDown = true;
            this.#shutdownSignal = new Signal();
        }

        if ( this.isFinished ) return;

        return this.#shutdownSignal.wait();
    }

    on ( name, listener ) {
        this.#events.on( name, listener );

        return this;
    }

    once ( name, listener ) {
        this.#events.once( name, listener );

        return this;
    }

    off ( name, listener ) {
        this.#events.off( name, listener );

        return this;
    }

    // private
    get #events () {
        return ( this.#_events ??= new Events() );
    }

    #setMaxThreads ( value ) {
        if ( value !== Infinity && ( !Number.isInteger( value ) || value < 0 ) ) throw TypeError( `Semaphore maxThreads value must be integer >= 0 or Infinity` );

        this.#maxThreads = value;
    }

    async #runThread ( method, args, unshift ) {

        // service is shutting down
        if ( this.#isShuttingDown ) return result( -32816 );

        // decline request if queue is full, "429 Too Many Requests"
        if ( !this.totalFreeThreads ) return result( 429 );

        // start thread
        await this.down( unshift );

        var res;

        try {
            res = result.try( await method( ...args ), { "allowUndefined": true } );
        }
        catch ( e ) {
            res = result.catch( e, { "keepError": true } );
        }

        // finish thread
        this.up();

        return res;
    }

    #runWaitingThreads () {

        // run pending threads
        while ( this.waitingThreads && this.freeThreads ) {
            this.#runningThreads++;

            this.#waitingThreads.shift()();
        }

        // has emptry slots
        if ( !this.#isShuttingDown && this.freeThreads ) this.#_events?.emit( "freeThreads", this );

        // all threads were finished
        if ( this.isFinished ) {

            // shutdown complete, trry call shutdown signal
            if ( this.#isShuttingDown ) this.#shutdownSignal.broadcast();

            this.#_events?.emit( "finish", this );
        }
    }
}
