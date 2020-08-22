module.exports = class MaxThreads {
    #maxThreads;
    #threads = 0;
    #queue = [];
    #paused = false;

    constructor ( count ) {
        this.#maxThreads = count || 0;
    }

    get maxThreads () {
        return this.#maxThreads;
    }

    set maxThreads ( count ) {
        this.#maxThreads = count;

        this._runThreads();
    }

    get threads () {
        return this.#threads;
    }

    get freeThreads () {
        return this.#maxThreads - this.#threads;
    }

    get waitingThreads () {
        return this.#queue.length;
    }

    get threadsPaused () {
        return this.#paused;
    }

    threadsPause () {
        this.#paused = true;
    }

    threadsResume () {
        this.#paused = false;

        this._runThreads();
    }

    _runThreads () {
        while ( !this.#paused && this.#threads < this.#maxThreads && this.#queue.length ) {
            this.#threads++;

            this.#queue.shift()();
        }
    }

    async runThread () {

        // push thread to the queue
        const promise = new Promise( resolve => this.#queue.push( resolve ) );

        this._runThreads();

        await promise;

        let res;

        try {
            res = await this._thread( ...arguments );
        }
        catch ( e ) {
            res = Promise.reject( e );
        }

        this.#threads--;

        this._runThreads();

        return res;
    }
};
