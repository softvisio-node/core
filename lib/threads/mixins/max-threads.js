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

                this.#runThreads();
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

            get queueLength () {
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

                this.#runThreads();
            }

            #runThreads () {
                while ( !this.#paused && ( !this.#maxThreads || this.#threads < this.#maxThreads ) && this.#queue.length ) {
                    this.#threads++;

                    this.#queue.shift()();
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
    } );
