import "#lib/result";
import Counter from "#lib/threads/counter";
import Mutex from "#lib/threads/mutex";

export default class StartManager {
    #isStarted = false;
    #startMutex = new Mutex();
    #stopMutex = new Mutex();
    #activeRequestsCounter = new Counter();
    #abortController = new AbortController();
    #onStart;
    #onStop;

    constructor ( { onStart, onStop } = {} ) {
        this.onStart = onStart;
        this.onStop = onStop;
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

    get onStart () {
        return this.#onStart;
    }

    set onStart ( callback ) {
        this.#onStart = callback;
    }

    get onStop () {
        return this.#onStop;
    }

    set onStop ( callback ) {
        this.#onStop = callback;
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
            res = result.try( await this._onStart( options ), {
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

    // XXX force - override pending calls
    async stop ( { graceful = true, ...options } = {} ) {
        if ( !this.#isStarted ) return result( 200 );

        // already stopping
        if ( !this.#stopMutex.tryLock() ) return this.#stopMutex.wait();

        // wait for start
        if ( this.#startMutex.isLocked ) {
            await this.#startMutex.wait();
        }

        // XXX
        // wait for active requests finished
        if ( graceful ) {
            await this.#activeRequestsCounter.wait();
        }

        // stop
        var res;

        try {
            res = result.try( await this._onStop( options ), {
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

    startRequest () {
        this.#activeRequestsCounter.value++;
    }

    finishRequest () {
        this.#activeRequestsCounter.value--;
    }

    // protected
    async _onStart ( options ) {
        return this.#onStart?.( options );
    }

    async _onStop ( options ) {
        return this.#onStop?.( options );
    }
}
