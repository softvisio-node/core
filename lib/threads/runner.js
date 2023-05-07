import "#lib/result";
import Set from "#lib/threads/set";
import Events from "#lib/events";
import Deque from "#lib/data/deque";
import Signal from "#lib/threads/signal";

const DEFAULT_MAX_THREADS = 1,
    DEFAULT_MAX_WAITING_THREADS = Infinity;

class ThreadsRunnerSet extends Set {

    // protected
    _createTarget ( id, options = {} ) {
        const item = new ThreadsRunner( { ...options, id } );

        item.on( "finish", this._onItemFinish.bind( this, id ) );

        return item;
    }

    _isTargetDestroyable ( item ) {
        return item.isFinished;
    }
}

export default class ThreadsRunner {
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
        return ThreadsRunnerSet;
    }

    // properties
    get id () {
        return this.#id;
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

    // can be Infinity
    get maxWaitingThreads () {
        return this.#maxWaitingThreads;
    }

    set maxWaitingThreads ( value ) {
        if ( value !== Infinity ) {
            if ( !Number.isInteger( value ) ) throw TypeError( `Semaphore maxWaitingThreads value is invalid` );

            if ( value < 0 ) throw Error( `Semaphore maxWaitingThreads value is invalid` );
        }

        this.#maxWaitingThreads = value;
    }

    get runningThreads () {
        return this.#runningThreads;
    }

    get freeThreads () {
        const freeThreads = this.#maxThreads - this.#runningThreads;

        return freeThreads < 0 ? 0 : freeThreads;
    }

    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    get freeWaitingThreads () {
        const freeWaitingThreads = this.#maxWaitingThreads - this.waitingThreads;

        return freeWaitingThreads < 0 ? 0 : freeWaitingThreads;
    }

    get totalFreeThreads () {
        const freeThreads = this.#maxThreads - this.#runningThreads,
            freeWaitingThreads = this.#maxWaitingThreads - this.waitingThreads,
            totalFreeThreads = freeThreads + freeWaitingThreads;

        return totalFreeThreads < 0 ? 0 : totalFreeThreads;
    }

    get isFinished () {
        return !this.#runningThreads && !this.waitingThreads;
    }

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    // public
    async runThread ( method, ...args ) {
        return this.#runThread( method, args, false );
    }

    async unshiftThread ( method, ...args ) {
        return this.#runThread( method, args, true );
    }

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
        if ( !Number.isInteger( value ) ) throw TypeError( `Semaphore maxThreads value is invalid` );

        if ( value <= 0 ) throw Error( `Semaphore maxThreads value is invalid` );

        this.#maxThreads = value;
    }

    async #runThread ( method, args, unshift ) {

        // service is shutting down
        if ( this.#isShuttingDown ) return result( -32816 );

        // decline request if queue is full, "429 Too Many Requests"
        if ( !this.totalFreeThreads ) return result( 429 );

        // start thread
        await this.#startThread( unshift );

        var res;

        try {

            // service is shutting down
            if ( this.#isShuttingDown ) throw result( -32816 );

            res = result.try( await method( ...args ), { "allowUndefined": true } );
        }
        catch ( e ) {
            res = result.catch( e, { "keepError": true } );
        }

        // finish thread
        this.#finishThread();

        return res;
    }

    async #startThread ( unshift ) {
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

    #finishThread () {
        this.#runningThreads--;

        this.#runWaitingThreads();
    }

    #runWaitingThreads () {

        // run pending threads
        while ( this.waitingThreads && this.freeThreads ) {
            const thread = this.#waitingThreads.shift();

            this.#runningThreads++;

            thread();
        }

        // has emptry slots
        if ( !this.#isShuttingDown && this.freeThreads ) this.#_events?.emit( "freeThreads", this );

        // all threads were finished
        if ( this.isFinished ) {

            // shutdown complete
            if ( this.#isShuttingDown ) this.#shutdownSignal.broadcast();

            this.#_events?.emit( "finish", this );
        }
    }
}
