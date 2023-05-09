import "#lib/result";
import Set from "#lib/threads/set";
import Events from "#lib/events";
import Deque from "#lib/data/deque";
import Signal from "#lib/threads/signal";

const DEFAULT_MAX_THREADS = 1,
    DEFAULT_MAX_WAITING_THREADS = Infinity;

class ThreadsPoolsSet extends Set {

    // protected
    _createTarget ( id, options = {} ) {
        const target = new ThreadsPool( { ...options, id } );

        target.on( "empty", this._destroyTarget.bind( this, id ) );

        return target;
    }

    _isTargetDestroyable ( target ) {
        return target.isEmpty && !target.isPaused;
    }
}

export default class ThreadsPool {
    #id;
    #maxThreads;
    #maxWaitingThreads;
    #runningThreads = 0;
    #waitingThreads = new Deque();
    #paused = false;
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
        return ThreadsPoolsSet;
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

        return this.#freeThreads;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    get freeWaitingThreads () {
        if ( this.#isShuttingDown ) return 0;

        const freeWaitingThreads = this.#maxWaitingThreads - this.waitingThreads;

        return freeWaitingThreads < 0 ? 0 : freeWaitingThreads;
    }

    get totalThreads () {
        return this.#maxThreads + this.#maxWaitingThreads;
    }

    get totalFreeThreads () {
        return this.freeThreads + this.freeWaitingThreads;
    }

    get isEmpty () {
        return !this.#runningThreads && !this.waitingThreads;
    }

    get isPaused () {
        return this.#paused;
    }

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    get stats () {
        return {
            "maxThreads": this.maxThreads,
            "maxWaitingThreads": this.maxWaitingThreads,
            "totalThreads": this.totalThreads,
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

    async runHighPriorityThread ( method, ...args ) {
        return this.#runThread( method, args, true );
    }

    pause () {
        this.#paused = true;

        return this;
    }

    resume () {
        if ( this.#paused ) {
            this.#paused = false;

            this.#runWaitingThreads();
        }

        return this;
    }

    // XXX whet to do, if is paused
    async shutDown () {
        if ( !this.#isShuttingDown ) {
            this.#isShuttingDown = true;
            this.#shutdownSignal = new Signal();
        }

        if ( this.isEmpty ) return;

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

    get #freeThreads () {
        const freeThreads = this.#maxThreads - this.#runningThreads;

        return freeThreads < 0 ? 0 : freeThreads;
    }

    #setMaxThreads ( value ) {
        if ( value !== Infinity && ( !Number.isInteger( value ) || value <= 0 ) ) throw TypeError( `Semaphore maxThreads value must be integer > 0 or Infinity` );

        this.#maxThreads = value;
    }

    async #runThread ( method, args, highPriority ) {

        // service is shutting down
        if ( this.#isShuttingDown ) return result( -32816 );

        // start thread
        if ( this.#freeThreads && !this.#paused ) {
            this.#runningThreads++;
        }
        else {

            // too Many Requests"
            if ( !this.freeWaitingThreads ) return result( -32802 );

            if ( highPriority ) {
                await new Promise( resolve => this.#waitingThreads.unshift( resolve ) );
            }
            else {
                await new Promise( resolve => this.#waitingThreads.push( resolve ) );
            }
        }

        var res;

        // run thread
        try {
            res = result.try( await method( ...args ), { "allowUndefined": true } );
        }
        catch ( e ) {
            res = result.catch( e, { "keepError": true } );
        }

        // finish thread
        this.#runningThreads--;

        this.#runWaitingThreads();

        return res;
    }

    #runWaitingThreads () {

        // run pending threads
        while ( this.waitingThreads && this.#freeThreads && !this.#paused ) {
            this.#runningThreads++;

            this.#waitingThreads.shift()();
        }

        // has free threads
        if ( this.freeThreads ) this.#_events?.emit( "freeThreads", this );

        // pool is empty
        if ( this.isEmpty ) {

            // shutdown complete, trry call shutdown signal
            if ( this.#isShuttingDown ) this.#shutdownSignal.broadcast();

            this.#_events?.emit( "empty", this );
        }
    }
}
