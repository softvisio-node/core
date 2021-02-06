const result = require( "../../result" );

module.exports = Super =>
    class MaxThreads extends ( Super || Object ) {
        #maxThreads;
        #maxQueueLength;
        #threads = 0;
        #queue = [];
        #paused = false;

        get maxThreads () {
            return this.#maxThreads;
        }

        set maxThreads ( count ) {
            if ( count === Infinity ) count = 0;

            this.#maxThreads = count;

            this.#runThreads();
        }

        get maxQueueLength () {
            return this.#maxQueueLength;
        }

        set maxQueueLength ( maxQueueLength ) {
            if ( maxQueueLength === Infinity ) maxQueueLength = 0;

            this.#maxQueueLength = maxQueueLength;
        }

        get runningThreads () {
            return this.#threads;
        }

        get pendingThreads () {
            return this.#maxThreads ? this.#maxThreads - this.#threads : Infinity;
        }

        get queueLength () {
            return this.#queue.length;
        }

        // returns number of free queue slots
        get queueSlots () {
            return this.#maxQueueLength ? this.#maxQueueLength - this.#queue.length : Infinity;
        }

        get paused () {
            return this.#paused;
        }

        pauseThreads () {
            this.#paused = true;

            if ( typeof this.emit === "function" ) this.emit( "paused" );
        }

        resumeThreads () {
            this.#paused = false;

            if ( typeof this.emit === "function" ) this.emit( "resumed" );

            this.#runThreads();
        }

        #runThreads () {
            while ( !this.#paused && this.pendingThreads > 0 && this.#queue.length ) {
                this.#threads++;

                this.#queue.shift()();
            }

            // emit status events
            if ( typeof this.emit === "function" && !this.#paused ) {
                if ( !this.queueLength ) this.emit( "drain" );

                if ( this.pendingThreads ) this.emit( "pending" );
            }
        }

        async runThread ( method, ...args ) {

            // decline request if queue is full, "429 Too Many Requests"
            if ( this.maxQueueLength && this.queueLength >= this.maxQueueLength ) return result( 429 );

            // push thread to the queue
            const promise = new Promise( resolve => this.#queue.push( resolve ) );

            this.#runThreads();

            await promise;

            let res;

            try {
                if ( typeof method === "string" ) {
                    res = result.tryResult( await this[method]( ...args ) );
                }
                else {
                    res = result.tryResult( await method( ...args ) );
                }
            }
            catch ( e ) {
                res = result.catchResult( e );
            }

            this.#threads--;

            this.#runThreads();

            return res;
        }
    };
