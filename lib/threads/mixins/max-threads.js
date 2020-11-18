const { mixin } = require( "../../mixins" );
const result = require( "../../result" );

module.exports = mixin( Super =>
    class MaxThreads extends Super {
            #maxThreads;
            #maxQueueLength;
            #threads = 0;
            #queue = [];
            #paused = false;

            get maxThreads () {
                return this.#maxThreads;
            }

            set maxThreads ( count ) {
                this.#maxThreads = count;

                this._runThreads();
            }

            get maxQueueLength () {
                return this.#maxQueueLength;
            }

            set maxQueueLength ( maxQueueLength ) {
                this.#maxQueueLength = maxQueueLength;
            }

            get runningThreads () {
                return this.#threads;
            }

            get pendingThreads () {
                return this.#maxThreads ? this.#maxThreads - this.#threads : Infinity;
            }

            get queueLenght () {
                return this.#queue.length;
            }

            get pauseThreadsd () {
                return this.#paused;
            }

            pauseThreads () {
                this.#paused = true;
            }

            resumeThreads () {
                this.#paused = false;

                this._runThreads();
            }

            _runThreads () {
                while ( !this.#paused && ( !this.#maxThreads || this.#threads < this.#maxThreads ) && this.#queue.length ) {
                    this.#threads++;

                    this.#queue.shift()();
                }
            }

            async runThread ( method, ...args ) {
                if ( this.maxQueueLength && this.queueLength >= this.maxQueueLength ) return result( [500, "Queue is full"] );

                // push thread to the queue
                const promise = new Promise( resolve => this.#queue.push( resolve ) );

                this._runThreads();

                await promise;

                let res;

                try {
                    res = await this[method]( ...args );
                }
                catch ( e ) {
                    res = Promise.reject( e );
                }

                this.#threads--;

                this._runThreads();

                return res;
            }
    } );
