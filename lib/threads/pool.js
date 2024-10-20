import "#lib/result";
import Deque from "#lib/data-structures/deque";
import Events from "#lib/events";
import ProxyFinalizationRegistry from "#lib/proxy-finalization-registry";
import Signal from "#lib/threads/signal";

const DEFAULT_MAX_RUNNING_THREADS = 1,
    DEFAULT_MAX_WAITING_THREADS = Infinity;

class ThreadsPoolsSet extends ProxyFinalizationRegistry {

    // protected
    _createTarget ( id, destroy, options = {} ) {
        return new ThreadsPool( { ...options, id, destroy } );
    }

    _isTargetDestroyable ( target ) {
        return target.isDestroyable;
    }
}

export default class ThreadsPool {
    #id;
    #destroy;
    #maxRunningThreads;
    #maxWaitingThreads;
    #runningThreads = 0;
    #waitingThreads = new Deque();
    #isPaused = false;
    #isShuttingDown = false;
    #shutdownSignal;
    #_events;

    constructor ( { id, destroy, maxRunningThreads, maxWaitingThreads } = {} ) {
        this.#id = id;
        this.#destroy = destroy;
        this.#setMaxRunningThreads( maxRunningThreads ?? DEFAULT_MAX_RUNNING_THREADS );
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

    get isDestroyable () {
        return !this.#_events?.listenerCount() && this.isEmpty && !this.isPaused;
    }

    get maxRunningThreads () {
        return this.#maxRunningThreads;
    }

    set maxRunningThreads ( value ) {
        const oldValue = this.#maxRunningThreads;

        this.#setMaxRunningThreads( value );

        if ( this.#maxRunningThreads > oldValue ) {
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

        return this.#realFreeThreads;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    get freeWaitingThreads () {
        if ( this.#isShuttingDown ) return 0;

        const freeWaitingThreads = this.#maxWaitingThreads - this.waitingThreads;

        return freeWaitingThreads < 0
            ? 0
            : freeWaitingThreads;
    }

    get totalThreads () {
        return this.#maxRunningThreads + this.#maxWaitingThreads;
    }

    get totalFreeThreads () {
        return this.freeThreads + this.freeWaitingThreads;
    }

    get isEmpty () {
        return !this.#runningThreads && !this.waitingThreads;
    }

    get isPaused () {
        return this.#isPaused;
    }

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    get stats () {
        return {
            "maxRunningThreads": this.maxRunningThreads,
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
    async runThread ( method, { args, highPriority } = {} ) {
        return this.#runThread( method, args, highPriority );
    }

    pause () {
        this.#isPaused = true;

        return this;
    }

    resume () {
        if ( this.#isPaused ) {
            this.#isPaused = false;

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
        if ( !this.#_events ) {
            this.#_events = new Events().watch( ( name, subscribe ) => {
                if ( !this.#_events.listenerCount() ) {
                    this.#destroy?.();
                }
            } );
        }

        return this.#_events;
    }

    get #realFreeThreads () {
        if ( this.#isPaused ) return 0;

        const freeThreads = this.#maxRunningThreads - this.#runningThreads;

        return freeThreads < 0
            ? 0
            : freeThreads;
    }

    #setMaxRunningThreads ( value ) {
        if ( !Number.isInteger( value ) || value <= 0 ) throw TypeError( `Semaphore maxRunningThreads value must be integer > 0` );

        this.#maxRunningThreads = value;
    }

    async #runThread ( method, args, highPriority ) {

        // service is shutting down
        if ( this.#isShuttingDown ) return result( -32_816 );

        // start thread immediately
        if ( this.#realFreeThreads ) {
            this.#runningThreads++;
        }

        // add thread to the queue
        else {

            // queue is full, too many requests"
            if ( !this.freeWaitingThreads ) return result( -32_802 );

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
            res = result.catch( e );
        }

        // finish thread
        this.#runningThreads--;

        this.#runWaitingThreads();

        return res;
    }

    #runWaitingThreads () {

        // run waiting threads
        while ( this.waitingThreads && this.#realFreeThreads ) {
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

            this.#destroy?.();
        }
    }
}
