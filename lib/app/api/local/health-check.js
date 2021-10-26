import Mutex from "#lib/threads/mutex";

export default Super =>
    class HealtCheck extends ( Super || Object ) {
        #healthCheckState;
        #healthCheckUpdateInterval = 1000;
        #healthCheckLastUpdated;
        #healthCheckMutex = new Mutex();

        async _new ( options ) {
            if ( options.healthCheckUpdateInterval ) this.#healthCheckUpdateInterval = options.healthCheckUpdateInterval;

            var res = super._new ? await super._new( options ) : result( 200 );

            return res;
        }

        async healthCheck () {

            // return cached result
            if ( this.#healthCheckLastUpdated && this.#healthCheckUpdateInterval && new Date() - this.#healthCheckLastUpdated < this.#healthCheckUpdateInterval ) {
                return this.#healthCheckState;
            }

            if ( this.#healthCheckMutex.tryDown() ) {

                // run health check
                try {
                    this.#healthCheckState = await this._healthCheck();
                }
                catch ( e ) {
                    this.#healthCheckState = result( 500 );
                }

                this.#healthCheckLastUpdated = new Date();

                this.#healthCheckMutex.up();

                this.#healthCheckMutex.signal.broadcast();
            }
            else {
                await this.#healthCheckMutex.signal.wait();
            }

            return this.#healthCheckState;
        }

        async _healthCheck () {
            return result( 200 );
        }
    };
