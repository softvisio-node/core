import "#lib/result";
import Events from "#lib/events";
import Signal from "./signal.js";
import uuidV4 from "#lib/uuid";

class SemaphoreSet extends Events {
    #maxThreads;
    #maxWaitingThreads;
    #destroyOnDone;
    #semaphores = {};

    constructor ( { maxThreads, maxWaitingThreads, destroyOnDone } = {} ) {
        super();

        this.#maxThreads = maxThreads;
        this.#maxWaitingThreads = maxWaitingThreads;
        this.#destroyOnDone = !!destroyOnDone;
    }

    // properties
    get maxThreads () {
        return this.#maxThreads;
    }

    get maxWaitingThreads () {
        return this.#maxWaitingThreads;
    }

    get destroyOnDone () {
        return this.#destroyOnDone;
    }

    // public
    has ( id ) {
        return !!this.#semaphores[id];
    }

    get ( id ) {
        var semaphore = this.#semaphores[id];

        if ( !semaphore ) {
            semaphore = this.#semaphores[id] = new this._Semaphore( { id, "maxThreads": this.#maxThreads, "maxWaitingThreads": this.#maxWaitingThreads } );

            semaphore.on( "free", semaphore => this.emit( "free", semaphore ) );

            semaphore.on( "done", semaphore => {
                if ( this.#destroyOnDone ) semaphore.destroy();

                this.emit( "done", semaphore );
            } );

            semaphore.on( "destroy", semaphore => {
                delete this.#semaphores[semaphore.id];

                this.emit( "destroy", semaphore );
            } );
        }

        return semaphore;
    }

    // protected
    get _Semaphore () {
        return Semaphore;
    }
}

export default class Semaphore extends Events {
    #id;
    #maxThreads;
    #maxWaitingThreads;
    #runningThreads = 0;
    #waitingThreads = [];
    #paused = false;
    #isDestroyed = false;
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
        this.#id ||= uuidV4();

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
            "totalThreads": this.totalThreads,
            "totalFreeThreads": this.totalFreeThreads,
        };
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

        this.#runWaitingThreads();
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

    get isDestroyed () {
        return this.#isDestroyed;
    }

    // public
    // XXX terminate waiting threads???
    destroy () {
        if ( this.#isDestroyed ) return;

        this.#isDestroyed = true;

        this.emit( "destroy", this );
    }

    pause () {
        if ( this.#paused ) return;

        this.#paused = true;

        this.emit( "pause", this );
    }

    resume () {
        if ( !this.#paused ) return;

        this.#paused = false;

        this.emit( "resume", this );

        this.#runWaitingThreads();
    }

    #runWaitingThreads () {
        while ( !this.#paused && this.waitingThreads && this.freeThreads ) {
            const thread = this.#waitingThreads.shift();

            this.#runningThreads++;

            thread();
        }

        // emit
        if ( !this.#paused && this.totalFreeThreads ) {

            // has emptry slots
            this.emit( "free", this );

            // all threads done
            if ( !this.#runningThreads ) this.emit( "done", this );
        }
    }

    async runThread ( method, ...args ) {
        if ( this.#isDestroyed ) throw Error( `Semapthore is destroyed` );

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
        if ( this.#isDestroyed ) throw Error( `Semapthore is destroyed` );

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
        if ( this.#isDestroyed ) throw Error( `Semapthore is destroyed` );

        if ( this.isLocked || this.isPaused ) return false;

        this.#runningThreads++;

        return true;
    }

    // wait for free thread, start thread
    async startThread ( unshift ) {
        if ( this.#isDestroyed ) throw Error( `Semapthore is destroyed` );

        // wait for free slot, if unable to run thread immetiately
        if ( !this.freeThreads ) {
            await new Promise( resolve => {
                if ( unshift ) {
                    this.#waitingThreads.unshift( resolve );
                }
                else {
                    this.#waitingThreads.push( resolve );
                }
            } );
        }
        else {
            this.#runningThreads++;
        }
    }

    // end current thread, call next thread from the waiting threads queue, if possible
    endThread () {
        this.#runningThreads--;

        this.#runWaitingThreads();
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
