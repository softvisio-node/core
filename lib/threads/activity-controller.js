import "#lib/result";
import Counter from "#lib/threads/counter";
import Mutex from "#lib/threads/mutex";

export default class ActivityController {
    #isStarted = false;
    #startMutex = new Mutex();
    #stopMutex = new Mutex();
    #activeRequestsCounter = new Counter();
    #abortController = new AbortController();
    #doStart;
    #doStop;

    constructor ( { doStart, doStop } = {} ) {
        this.doStart = doStart;
        this.doStop = doStop;
    }

    // properties
    get isStarted () {
        return this.#isStarted;
    }

    get isStarting () {
        return this.#startMutex.isLocked;
    }

    get isStopping () {
        return this.#stopMutex.isLocked;
    }

    get activeRequestsCount () {
        return this.#activeRequestsCounter.value;
    }

    get abortSignal () {
        return this.#abortController.signal;
    }

    get doStart () {
        return this.#doStart;
    }

    set doStart ( callback ) {
        this.#doStart = callback;
    }

    get doStop () {
        return this.#doStop;
    }

    set doStop ( callback ) {
        this.#doStop = callback;
    }

    // public
    async start ( { ...options } = {} ) {
        if ( this.#isStarted ) return result( 200 );

        // already starting
        if ( !this.#startMutex.tryLock() ) return this.#startMutex.wait();

        // wait for stop
        if ( this.#stopMutex.isLocked ) {
            await this.#stopMutex.wait();
        }

        // start
        var res;

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

    async stop ( { graceful = true, ...options } = {} ) {
        if ( !this.#isStarted ) return result( 200 );

        // already stopping
        if ( !this.#stopMutex.tryLock() ) return this.#stopMutex.wait();

        // wait for start
        if ( this.#startMutex.isLocked ) {
            await this.#startMutex.wait();
        }

        // wait for active requests finished
        if ( graceful ) {
            await this.#activeRequestsCounter.wait();
        }

        // stop
        var res;

        try {
            res = result.try( await this._doStop( options ), {
                "allowUndefined": true,
            } );
        }
        catch ( e ) {
            res = result.catch( e, {
                "log": false,
            } );
        }

        // stopped
        if ( res.ok ) {
            this.#isStarted = false;

            var abortController = this.#abortController;

            this.#abortController = new AbortController();
        }

        this.#stopMutex.unlock( res );

        abortController?.abort();

        return res;
    }

    startActivity () {
        this.#activeRequestsCounter.value++;
    }

    finishActivity () {
        this.#activeRequestsCounter.value--;
    }

    // protected
    async _doStart ( options ) {
        return this.#doStart?.( options );
    }

    async _doStop ( options ) {
        return this.#doStop?.( options );
    }
}
