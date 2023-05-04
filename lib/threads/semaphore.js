import "#lib/result";
import Events from "#lib/events";
import Signal from "./signal.js";
import uuidV4 from "#lib/uuid";
import Deque from "#lib/data/deque";

class SemaphoreSet extends Events {
    #maxThreads;
    #maxWaitingThreads;
    #destroyOnFinish;
    #semaphores = {};

    constructor ( { maxThreads, maxWaitingThreads, destroyOnFinish } = {} ) {
        super();

        this.#maxThreads = maxThreads;
        this.#maxWaitingThreads = maxWaitingThreads;
        this.#destroyOnFinish = !!destroyOnFinish;
    }

    // properties
    get maxThreads () {
        return this.#maxThreads;
    }

    get maxWaitingThreads () {
        return this.#maxWaitingThreads;
    }

    get destroyOnFinish () {
        return this.#destroyOnFinish;
    }

    // public
    has ( id ) {
        return !!this.#semaphores[id];
    }

    get ( id ) {
        var semaphore = this.#semaphores[id];

        if ( !semaphore ) {
            semaphore = this.#semaphores[id] = new this.Semaphore( {
                id,
                "maxThreads": this.#maxThreads,
                "maxWaitingThreads": this.#maxWaitingThreads,
                "destroyOnFinish": this.#destroyOnFinish,
            } );

            semaphore.on( "free", semaphore => this.emit( "free", semaphore ) );

            semaphore.on( "finish", semaphore => this.emit( "finish", semaphore ) );

            semaphore.on( "destroy", semaphore => {
                delete this.#semaphores[semaphore.id];

                this.emit( "destroy", semaphore );
            } );
        }

        return semaphore;
    }

    get Semaphore () {
        return Semaphore;
    }
}

export default class Semaphore extends Events {
    #id;
    #maxThreads;
    #maxWaitingThreads;
    #destroyOnFinish;
    #runningThreads = 0;
    #waitingThreads = new Deque();
    #isPaused = false;
    #isDestroyed = false;
    #signal;
    #isShuttingDown = false;
    #shutdownSignal;

    constructor ( { id, maxThreads, maxWaitingThreads, destroyOnFinish } = {} ) {
        super();

        this.#id = id;
        this.maxThreads = maxThreads;
        this.maxWaitingThreads = maxWaitingThreads;
        this.#destroyOnFinish = !!destroyOnFinish;
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

        const oldMaxThreads = this.#maxThreads;

        this.#maxThreads = value;

        if ( oldMaxThreads !== null && this.#maxThreads > oldMaxThreads ) this.#runWaitingThreads();
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

    get destroyOnFinish () {
        return this.#destroyOnFinish;
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
        const freeWaitingThreads = this.#maxWaitingThreads - this.waitingThreads;

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
        return this.#isPaused;
    }

    get isFinished () {
        return !this.waitingThreads && !this.#runningThreads;
    }

    get isDestroyed () {
        return this.#isDestroyed;
    }

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    get signal () {
        this.#signal ??= new Signal();

        return this.#signal;
    }

    // public
    // XXX pending threads
    // XXX remove this method???
    destroy () {
        if ( this.#isDestroyed ) return;

        this.#isDestroyed = true;

        this.#cancelWaitingThreads();

        this.emit( "destroy", this );
    }

    async shutDown () {
        if ( !this.#isShuttingDown ) {
            this.#isShuttingDown = true;
            this.#shutdownSignal = new Signal();

            this.#cancelWaitingThreads();
        }

        if ( !this.#runningThreads ) return;

        return this.#shutdownSignal.wait();
    }

    pause () {
        if ( this.#isPaused ) return;

        this.#isPaused = true;

        this.emit( "pause", this );
    }

    resume () {
        if ( !this.#isPaused ) return;

        this.#isPaused = false;

        this.emit( "resume", this );

        this.#runWaitingThreads();
    }

    async runThread ( method, ...args ) {
        return this.#runThread( method, args, false );
    }

    async unshiftThread ( method, ...args ) {
        return this.#runThread( method, args, true );
    }

    tryDown () {
        if ( this.isLocked || this.isPaused ) return false;

        this.#runningThreads++;

        return true;
    }

    async down ( unshift ) {

        // wait for free slot, if unable to run thread immetiately
        if ( !this.freeThreads ) {
            return new Promise( resolve => {
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

    up () {
        this.#runningThreads--;

        if ( this.#isShuttingDown && !this.#runningThreads ) this.#shutdownSignal.broadcast();

        this.#runWaitingThreads();
    }

    // private
    async #runThread ( method, args, unshift ) {

        // service is shutting down
        if ( this.#isShuttingDown ) return result( -32816 );

        // decline request if queue is full, "429 Too Many Requests"
        if ( !this.totalFreeThreads ) return result( 429 );

        await this.down( unshift );

        // service is shutting down
        if ( this.#isShuttingDown ) return result( -32816 );

        var res;

        // run thread code
        try {
            res = result.try( await method( ...args ), { "allowUndefined": true } );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        this.up();

        return res;
    }

    // XXX process shutdown - do not throw events
    #runWaitingThreads () {
        while ( !this.#isPaused && this.waitingThreads && this.freeThreads ) {
            const thread = this.#waitingThreads.shift();

            this.#runningThreads++;

            thread();
        }

        if ( !this.#isPaused ) {

            // has emptry slots
            if ( this.totalFreeThreads ) this.emit( "free", this );

            // all threads were finished
            if ( this.isFinished ) {
                if ( this.#destroyOnFinish ) this.destroy();

                this.emit( "finish", this );
            }
        }
    }

    // XXX
    #cancelWaitingThreads () {}
}
