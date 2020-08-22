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

        while ( !this.#paused && this.#threads < this.#maxThreads && this.#queue.length ) this.#queue.shift()();
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

        while ( !this.#paused && this.#threads < this.#maxThreads && this.#queue.length ) this.#queue.shift()();
    }

    async runThread () {
        while ( 1 ) {
            if ( !this.#paused && this.#threads < this.#maxThreads ) {
                this.#threads++;

                let res;

                try {
                    res = await this._thread( ...arguments );
                }
                catch ( e ) {
                    res = Promise.reject( e );
                }

                this.#threads--;

                if ( !this.#paused && this.#threads < this.#maxThreads && this.#queue.length ) this.#queue.shift()();

                return res;
            }

            await new Promise( resolve => this.#queue.push( resolve ) );
        }
    }
};
