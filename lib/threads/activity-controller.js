import "#lib/result";
import Counter from "#lib/threads/counter";
import Mutex from "#lib/threads/mutex";

export default class ActivityController {
    #isInitialized = false;
    #isStarted = false;
    #isDestroyed = false;
    #initMutex = new Mutex();
    #startMutex = new Mutex();
    #stopMutex = new Mutex();
    #destroyMutex = new Mutex();
    #activeRequestsCounter = new Counter();
    #abortController = new AbortController();
    #doInit;
    #doStart;
    #doBeforeStop;
    #doStop;
    #doDestroy;

    constructor ( { doInit, doStart, doBeforeStop, doStop, doDestroy } = {} ) {
        this.doInit = doInit;
        this.doStart = doStart;
        this.doBeforeStop = doBeforeStop;
        this.doStop = doStop;
        this.doDestroy = doDestroy;
    }

    // properties
    get isInitializing () {
        return this.#initMutex.isLocked;
    }

    get isInitialized () {
        return this.#isInitialized;
    }

    get isStarted () {
        return this.#isStarted;
    }

    get isStarting () {
        return this.#startMutex.isLocked;
    }

    get isStopping () {
        return this.#stopMutex.isLocked;
    }

    get isDestroying () {
        return this.#destroyMutex.isLocked;
    }

    get isDestroyed () {
        return this.#isDestroyed;
    }

    get activeRequestsCount () {
        return this.#activeRequestsCounter.value;
    }

    get abortSignal () {
        return this.#abortController.signal;
    }

    get doInit () {
        return this.#doInit;
    }

    set doInit ( callback ) {
        this.#doInit = callback;
    }

    get doStart () {
        return this.#doStart;
    }

    set doStart ( callback ) {
        this.#doStart = callback;
    }

    get doBeforeStop () {
        return this.#doBeforeStop;
    }

    set doBeforeStop ( callback ) {
        this.#doBeforeStop = callback;
    }

    get doStop () {
        return this.#doStop;
    }

    set doStop ( callback ) {
        this.#doStop = callback;
    }

    get doDestroy () {
        return this.#doDestroy;
    }

    set doDestroy ( callback ) {
        this.#doDestroy = callback;
    }

    // public
    async init ( options ) {

        // destroyed
        if ( this.#isDestroyed ) return result( [ 400, "Destroyed" ] );

        // initialized
        if ( this.#isInitialized ) return result( 200 );

        // destroying
        if ( this.isDestroying ) {
            if ( this.isInitializing ) {
                return this.#initMutex.wait();
            }
            else {
                return result( [ 400, "Destroying" ] );
            }
        }

        // initializing
        if ( !this.#initMutex.tryLock() ) return this.#initMutex.wait();

        var res;

        // init
        try {
            res = result.try( await this._doInit( options ), {
                "allowUndefined": true,
            } );
        }
        catch ( e ) {
            res = result.catch( e, {
                "log": false,
            } );
        }

        // initialized
        if ( res.ok ) {
            this.#isInitialized = true;
        }

        this.#initMutex.unlock( res );

        return res;
    }

    async start ( options ) {

        // destroyed
        if ( this.#isDestroyed ) return result( [ 400, "Destroyed" ] );

        // started
        if ( this.#isStarted ) return result( 200 );

        // destroying
        if ( this.isDestroying ) {
            if ( this.isStarting ) {
                return this.#startMutex.wait();
            }
            else {
                return result( [ 400, "Destroying" ] );
            }
        }

        // starting
        if ( !this.#startMutex.tryLock() ) return this.#startMutex.wait();

        // wait for stop
        if ( this.isStopping ) {
            await this.#stopMutex.wait();
        }

        var res;

        // start
        try {
            res = result.try( await this._doStart( options ), {
                "allowUndefined": true,
            } );
        }
        catch ( e ) {
            res = result.catch( e, {
                "log": false,
            } );
        }

        // started
        if ( res.ok ) {
            this.#isStarted = true;
        }

        this.#startMutex.unlock( res );

        return res;
    }

    async stop ( options ) {

        // stopped
        if ( !this.#isStarted ) return result( 200 );

        // stopping
        if ( !this.#stopMutex.tryLock() ) return this.#stopMutex.wait();

        // wait for start
        if ( this.isStarting ) {
            await this.#startMutex.wait();
        }

        var res;

        try {

            // before stop
            res = result.try( await this._doBeforeStop( options ), {
                "allowUndefined": true,
            } );
            if ( !res.ok ) throw res;

            // wait for active requests finished
            await this.#activeRequestsCounter.wait();

            // stop
            res = result.try( await this._doStop( options ), {
                "allowUndefined": true,
            } );
            if ( !res.ok ) throw res;

            // stopped
            this.#isStarted = false;

            var abortController = this.#abortController;
            this.#abortController = new AbortController();
        }
        catch ( e ) {
            res = result.catch( e, {
                "log": false,
            } );
        }

        this.#stopMutex.unlock( res );

        abortController?.abort();

        return res;
    }

    async destroy ( options ) {

        // destroyed
        if ( this.#isDestroyed ) return result( 200 );

        // destroying
        if ( !this.#destroyMutex.tryLock() ) return this.#destroyMutex.wait();

        // wait for stop
        if ( this.isStopping ) {
            await this.#stopMutex.wait();
        }

        var res;

        // destroy
        try {
            res = result.try( await this._doDestroy( options ), {
                "allowUndefined": true,
            } );
        }
        catch ( e ) {
            res = result.catch( e, {
                "log": false,
            } );
        }

        // destroyed
        if ( res.ok ) {
            this.#isDestroyed = true;
        }

        this.#destroyMutex.unlock( res );

        return res;
    }

    startActivity () {
        this.#activeRequestsCounter.value++;
    }

    finishActivity () {
        this.#activeRequestsCounter.value--;
    }

    // protected
    async _doInit ( options ) {
        return this.#doInit?.( options );
    }

    async _doStart ( options ) {
        return this.#doStart?.( options );
    }

    async _doBeforeStop ( options ) {
        return this.#doBeforeStop?.( options );
    }

    async _doStop ( options ) {
        return this.#doStop?.( options );
    }

    async _doDestroy ( options ) {
        return this.#doDestroy?.( options );
    }
}
