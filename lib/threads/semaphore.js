/*
 * emits:
 *   - "pause", "resume";
 *   - "drain" - aftere thread is finished and not more waiting threads in the queue;
 *   - "free-threads" - after thread is finished and has free threads to run;
 */

const Events = require( "events" );
const result = require( "../result" );

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

        // push thread to the queue
        const promise = new Promise( resolve => this.#waitingThreads.push( resolve ) );

        this.#runThreads();

        await promise;

        let res;

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

        this.#runningThreads--;

        this.#runThreads();

        return res;
    }

    // CLASSIC SEMAPHORE INTERFACE
    get isLocked () {
        return !!( this.#maxThreads && this.#runningThreads >= this.#maxThreads );
    }

    // if locked - wait for unlock, lock and return
    // if unlocked - lock and return
    async lock () {
        while ( 1 ) {
            const promise = new Promise( resolve => this.#waitingThreads.push( resolve ) );

            this.#runThreads();

            // wait for unlock
            return await promise;
        }
    }

    // if locked - returns false
    // if unlocked - lock and returns true
    tryLock () {
        if ( this.isLocked || this.isPaused ) return false;

        this.#runningThreads++;

        return true;
    }

    // unlock one waiting thread
    unlock ( res ) {
        this.#runningThreads--;

        this.#runThreads( res );
    }

    // XXX
    // unlock all waiting threads
    unlockAll ( res ) {
        this.#runningThreads--;

        const threads = this.#waitingThreads;

        this.#waitingThreads = [];

        for ( const thread of threads ) thread( res );
    }

    // if locked - wait for unlock
    // if not locked - returns immediately
    async wait () {
        if ( !this.isLocked ) return;

        return new Promise( resolve => this.#waitingThreads.push( resolve ) );
    }
};
