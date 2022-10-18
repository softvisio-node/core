import Component from "#lib/app/api/component";
import Mutex from "#lib/threads/mutex";

export default class extends Component {
    #healthCheckState;
    #healthCheckUpdateInterval = 1000;
    #healthCheckLastUpdated;
    #healthCheckMutex = new Mutex();

    // public
    async init () {
        if ( this.api.config.healthCheckUpdateInterval ) this.#healthCheckUpdateInterval = this.api.config.healthCheckUpdateInterval;

        return result( 200 );
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

    // protected
    async _healthCheck () {
        return result( 200 );
    }
}
