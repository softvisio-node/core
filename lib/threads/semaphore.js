/*
 * emits:
 *   - "paused", "resumed";
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

    get maxThreads () {
        return this.#maxThreads;
    }

    set maxThreads ( count ) {
        if ( count === Infinity ) count = 0;

        this.#maxThreads = count;

        this.#runThreads();
    }

    // returns max queue length
    get maxWaitingThreads () {
        return this.#maxWaitingThreads;
    }

    set maxWaitingThreads ( maxWaitingThreads ) {
        if ( maxWaitingThreads === Infinity ) maxWaitingThreads = 0;

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

        this.emit( "paused" );
    }

    resume () {
        if ( !this.#paused ) return;

        this.#paused = false;

        this.emit( "resumed" );

        this.#runThreads();
    }

    #runThreads () {
        while ( !this.#paused && this.freeThreads > 0 && this.#waitingThreads.length ) {
            this.#runningThreads++;

            this.#waitingThreads.shift()();
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

    async down () {

        // try to down and return immediately on success
        if ( this.tryDown() ) return;

        // do not wait if no max threads limit
        if ( !this.#maxThreads ) return;

        while ( 1 ) {
            const promise = new Promise( resolve => this.#waitingThreads.push( resolve ) );

            // wait for up
            const res = await promise;

            // if ( this.isLocked ) continue;

            // this.#runningThreads++;

            return res;
        }
    }

    // if locked - returns false
    // if unlocked - lock and returns true
    tryDown () {

        // semaphore is locked
        if ( this.isLocked ) return false;

        // increment running threads
        this.#runningThreads++;

        // semaphore down
        return true;
    }

    unlock () {
        this.#runningThreads--;

        this.#runThreads();
    }

    unlockAll () {}

    async wait () {}
};
