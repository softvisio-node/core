import "#lib/result";
import Events from "#lib/events";
import Signal from "./signal.js";
import uuidV4 from "#lib/uuid";
import Deque from "#lib/data/deque";

class SemaphoreSet {
    #semaphores = {};
    #finalizationRegistry;

    constructor () {
        this.#finalizationRegistry = new FinalizationRegistry( this.#onProxyDestroy.bind( this ) );
    }

    // properties
    get Semaphore () {
        return Semaphore;
    }

    // public
    has ( id ) {
        return !!this.#semaphores[id];
    }

    get ( id, options ) {
        var semaphore;

        if ( !this.#semaphores[id] ) {
            semaphore = new this.Semaphore( {
                ...( options || {} ),
                id,
            } );

            semaphore.on( "finish", this.#deleteSemaphore.bind( this, id ) );

            semaphore.signal.on( "drain", this.#deleteSemaphore.bind( this, id ) );

            this.#semaphores[id] = {
                "proxies": 1,
                semaphore,
            };
        }
        else {
            semaphore = this.#semaphores[id].semaphore;

            this.#semaphores[id].proxies++;
        }

        const proxy = new Proxy( semaphore, {
            get ( target, property ) {
                const value = target[property];

                if ( typeof value === "function" ) {
                    return value.bind( target );
                }
                else {
                    return value;
                }
            },

            set ( target, property, value ) {
                target[property] = value;

                return true;
            },
        } );

        this.#finalizationRegistry.register( proxy, id );

        return proxy;
    }

    // private
    #onProxyDestroy ( id ) {
        this.#semaphores[id].proxies--;

        this.#deleteSemaphore( id );
    }

    #deleteSemaphore ( id ) {
        const semaphoreData = this.#semaphores[id];

        if ( semaphoreData.proxies ) return;

        if ( !semaphoreData.semaphore?.isFinished ) return;

        if ( semaphoreData.semaphore?.signal.waitingThreads ) return;

        delete this.#semaphores[id];
    }
}

export default class Semaphore {
    #id;
    #maxThreads;
    #maxWaitingThreads;
    #runningThreads = 0;
    #waitingThreads = new Deque();
    #signal;
    #isShuttingDown = false;
    #shutdownSignal;
    #_events;

    constructor ( { id, maxThreads, maxWaitingThreads } = {} ) {
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

    // can be Infinity, 0
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
        const freeWaitingThreads = this.#maxWaitingThreads - this.waitingThreads;

        return freeWaitingThreads < 0 ? 0 : freeWaitingThreads;
    }

    get totalFreeThreads () {
        const freeThreads = this.#maxThreads - this.#runningThreads,
            freeWaitingThreads = this.#maxWaitingThreads - this.waitingThreads;

        return freeThreads + freeWaitingThreads;
    }

    get isLocked () {
        return this.#runningThreads >= this.#maxThreads;
    }

    get isFinished () {
        return !this.waitingThreads && !this.#runningThreads;
    }

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    get signal () {
        return ( this.#signal ??= new Signal() );
    }

    // public
    tryDown () {
        if ( this.isLocked ) return false;

        this.#runningThreads++;

        return true;
    }

    async down ( unshift ) {
        if ( !this.isLocked ) {
            this.#runningThreads++;
        }
        else {
            return new Promise( resolve => {
                if ( unshift ) {
                    this.#waitingThreads.unshift( resolve );
                }
                else {
                    this.#waitingThreads.push( resolve );
                }
            } );
        }
    }

    up () {
        this.#runningThreads--;

        this.#runWaitingThreads();
    }

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

    async #runThread ( method, args, unshift ) {

        // service is shutting down
        if ( this.#isShuttingDown ) return result( -32816 );

        // decline request if queue is full, "429 Too Many Requests"
        if ( !this.totalFreeThreads ) return result( 429 );

        await this.down( unshift );

        // service is shutting down
        if ( this.#isShuttingDown ) {
            this.up();

            return result( -32816 );
        }

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

    #runWaitingThreads () {

        // run pending threads
        while ( this.waitingThreads && this.freeThreads ) {
            const thread = this.#waitingThreads.shift();

            this.#runningThreads++;

            thread();
        }

        // has emptry slots
        if ( !this.#isShuttingDown && this.freeThreads ) this.#events.emit( "freeThreads", this );

        // all threads were finished
        if ( this.isFinished ) {

            // shutdown complete
            if ( this.#isShuttingDown ) this.#shutdownSignal.broadcast();

            this.#events.emit( "finish", this );
        }
    }
}
