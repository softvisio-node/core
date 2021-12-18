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

            this.#semaphores[semaphore.id] = semaphore;
        }

        return this.#semaphores[id];
    }

    delete ( semaphore ) {
        const id = semaphore.id || semaphore;

        delete this.#semaphores[id];
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

    constructor ( { id, maxThreads, maxWaitingThreads } = {} ) {
        super();

        this.#id = id;
        this.maxThreads = maxThreads;
        this.maxWaitingThreads = maxWaitingThreads;
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

    // can be Infinity
    get maxThreads () {
        return this.#maxThreads;
    }

    set maxThreads ( value ) {
        if ( value == null ) value = Infinity;

        if ( value !== Infinity ) {
            value = Number( value );
            if ( isNaN( value ) || value <= 0 ) throw Error( `maxThreads value is invalid` );
        }

        this.#maxThreads = value;

        this.#runThreads();
    }

    // returns max queue length, can be Infinity, 0
    get maxWaitingThreads () {
        return this.#maxWaitingThreads;
    }

    set maxWaitingThreads ( value ) {
        if ( value == null ) value = Infinity;

        if ( value !== Infinity ) {
            value = Number( value );
            if ( isNaN( value ) || value < 0 ) throw Error( `maxWaitingThreads value is invalid` );
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

    // returns number of threads in the queue
    get waitingThreads () {
        return this.#waitingThreads.length;
    }

    // returns number of threads, that can be queued
    get freeWaitingThreads () {
        const freeWaitingThreads = this.#maxWaitingThreads - this.#waitingThreads.length;

        return freeWaitingThreads < 0 ? 0 : freeWaitingThreads;
    }

    get totalThreads () {
        return this.#maxThreads + this.#maxWaitingThreads;
    }

    get totalFreeThreads () {
        return this.freeThreads + this.freeWaitingThreads;
    }

    get isLocked () {
        return this.#runningThreads >= this.#maxThreads;
    }

    get isPaused () {
        return this.#paused;
    }

    // public
    pause () {
        if ( this.#paused ) return;

        this.#paused = true;

        this.emit( "pause", this );
    }

    resume () {
        if ( !this.#paused ) return;

        this.#paused = false;

        this.emit( "resume", this );

        this.#runThreads();
    }

    #runThreads ( res ) {
        while ( !this.#paused && this.freeThreads && this.waitingThreads ) {
            this.#runningThreads++;

            this.#waitingThreads.shift()( res );
        }

        // emit
        if ( !this.#paused && this.totalFreeThreads ) this.emit( "free", this );
    }

    async runThread ( method, ...args ) {

        // decline request if queue is full, "429 Too Many Requests"
        if ( !this.totalFreeThreads ) return result( 429 );

        await this.startThread();

        let res;

        // run thread code
        try {
            if ( typeof method === "string" ) {
                res = result.try( await this[method]( ...args ), { "allowUndefined": true } );
            }
            else {
                res = result.try( await method( ...args ), { "allowUndefined": true } );
            }
        }
        catch ( e ) {
            res = result.catch( e );
        }

        this.endThread();

        return res;
    }

    async unshiftThread ( method, ...args ) {

        // decline request if queue is full, "429 Too Many Requests"
        if ( !this.totalFreeThreads ) return result( 429 );

        await this.startThread( true );

        let res;

        // run thread code
        try {
            if ( typeof method === "string" ) {
                res = result.try( await this[method]( ...args ), { "allowUndefined": true } );
            }
            else {
                res = result.try( await method( ...args ), { "allowUndefined": true } );
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
    // XXX
    async startThread ( unshift ) {
        const promise = new Promise( resolve => ( unshift ? this.#waitingThreads.unshift( resolve ) : this.#waitingThreads.push( resolve ) ) );

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
