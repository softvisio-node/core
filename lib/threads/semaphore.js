/*
 * emits:
 *   - "pause", "resume";
 *   - "drain" - aftere thread is finished and not more waiting threads in the queue;
 *   - "free-threads" - after thread is finished and has free threads to run;
 */

require( "@softvisio/core" );
const Events = require( "events" );

module.exports = class Semaphore extends Events {
    #maxThreads = 0;
    #maxWaitingThreads = 0;
    #runningThreads = 0;
    #waitingThreads = [];
    #paused = false;

    constructor ( options = {} ) {
        super();

        if ( "maxThreads" in options ) this.maxThreads = options.maxThreads;

        if ( "maxWaitingThreads" in options ) this.maxWaitingThreads = options.maxWaitingThreads;
    }

    get maxThreads () {
        return this.#maxThreads;
    }

    set maxThreads ( maxThreads ) {
        if ( !maxThreads || maxThreads === Infinity ) maxThreads = 0;

        this.#maxThreads = maxThreads;

        this.#runThreads();
    }

    // returns max queue length
    get maxWaitingThreads () {
        return this.#maxWaitingThreads;
    }

    set maxWaitingThreads ( maxWaitingThreads ) {
        if ( !maxWaitingThreads || maxWaitingThreads === Infinity ) maxWaitingThreads = 0;

        this.#maxWaitingThreads = maxWaitingThreads;
    }

    get runningThreads () {
        return this.#runningThreads;
    }

    // XXX rename
    get freeThreads () {
        return this.#maxThreads ? this.#maxThreads - this.#runningThreads : Infinity;
    }

    // returns number of threads in the queue
    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    // returns number of threads, that can be queued
    get freeWaitingThreads () {
        return this.#maxWaitingThreads ? this.#maxWaitingThreads - this.#waitingThreads.length : Infinity;
    }

    get isPaused () {
        return this.#paused;
    }

    pause () {
        if ( this.#paused ) return;

        this.#paused = true;

        this.emit( "pause" );
    }

    resume () {
        if ( !this.#paused ) return;

        this.#paused = false;

        this.emit( "resume" );

        this.#runThreads();
    }

    #runThreads ( res ) {
        while ( !this.#paused && this.freeThreads > 0 && this.#waitingThreads.length ) {
            this.#runningThreads++;

            this.#waitingThreads.shift()( res );
        }

        // emit status events
        if ( !this.#paused ) {
            if ( !this.waitingThreads ) this.emit( "drain" );

            if ( this.freeThreads ) this.emit( "free-threads" );
        }
    }

    async runThread ( method, ...args ) {

        // decline request if queue is full, "429 Too Many Requests"
        if ( this.maxWaitingThreads && this.waitingThreads >= this.maxWaitingThreads ) return result( 429 );

        await this.startThread();

        let res;

        // run thread code
        try {
            if ( typeof method === "string" ) {
                res = result.tryResult( await this[method]( ...args ) );
            }
            else {
                res = result.tryResult( await method( ...args ) );
            }
        }
        catch ( e ) {
            res = result.catchResult( e );
        }

        this.endThread();

        return res;
    }

    // CLASSIC SEMAPHORE INTERFACE
    get isLocked () {
        return !!( this.#maxThreads && this.#runningThreads >= this.#maxThreads );
    }

    // wait for free thread, start thread
    async startThread () {
        const promise = new Promise( resolve => this.#waitingThreads.push( resolve ) );

        this.#runThreads();

        // wait for unlock
        return await promise;
    }

    // return true is thread was started
    tryStartThread () {
        if ( this.isLocked || this.isPaused ) return false;

        this.#runningThreads++;

        return true;
    }

    // end current thread, call next thread from the waiting threads queue, is possible
    endThread () {
        this.#runningThreads--;

        this.#runThreads();
    }
};
