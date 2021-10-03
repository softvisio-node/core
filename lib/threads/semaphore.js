import "#lib/result";
import Events from "#lib/events";
import Signal from "./signal.js";
import * as uuid from "#lib/uuid";

class SemaphoreSet {
    #semaphores = {};

    // public
    has ( id ) {
        return !!this.#semaphores[id];
    }

    get ( id ) {
        if ( !id || !this.#semaphores[id] ) {
            const semaphore = this._build( id );

            id = semaphore.id;

            this.#semaphores[id] = semaphore;

            semaphore.on( "destroy", () => delete this.#semaphores[id] );
        }

        return this.#semaphores[id];
    }

    // protected
    _build ( id ) {
        return new Semaphore( { id } );
    }
}

export default class Semaphore extends Events {
    #id;
    #maxThreads;
    #maxWaitingThreads;
    #runningThreads = 0;
    #waitingThreads = [];
    #paused = false;
    #signal;

    constructor ( options = {} ) {
        super();

        this.#id = options.id;
        this.maxThreads = options.maxThreads || 0;
        this.maxWaitingThreads = options.maxWaitingThreads || 0;
    }

    // static
    static get Set () {
        return SemaphoreSet;
    }

    // properties
    get id () {
        this.#id ||= uuid.v4();

        return this.#id;
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

    get isLocked () {
        return !!( this.#maxThreads && this.#runningThreads >= this.#maxThreads );
    }

    get isPaused () {
        return this.#paused;
    }

    // public
    destroy () {
        this.emit( "destroy" );
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
                res = result.try( await this[method]( ...args ) );
            }
            else {
                res = result.try( await method( ...args ) );
            }
        }
        catch ( e ) {
            res = result.catch( e );
        }

        this.endThread();

        return res;
    }

    // in-thread interface
    // returns true if thread was started
    tryStartThread () {
        if ( this.isLocked || this.isPaused ) return false;

        this.#runningThreads++;

        return true;
    }

    // wait for free thread, start thread
    async startThread () {
        const promise = new Promise( resolve => this.#waitingThreads.push( resolve ) );

        this.#runThreads();

        // wait for unlock
        return await promise;
    }

    // end current thread, call next thread from the waiting threads queue, if possible
    endThread () {
        this.#runningThreads--;

        this.#runThreads();
    }

    // classic semaphore interface
    tryDown () {
        return this.tryStartThread();
    }

    async down () {
        return this.startThread();
    }

    up () {
        return this.endThread();
    }

    // signal
    get signal () {
        this.#signal ??= new Signal();

        return this.#signal;
    }
}
