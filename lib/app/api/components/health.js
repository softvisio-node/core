import Component from "#lib/app/api/component";
import Mutex from "#lib/threads/mutex";

export default class extends Component {
    #healthCheckStatus;
    #healthCheckUpdateInterval = 1000;
    #healthCheckLastUpdated;
    #healthCheckMutex = new Mutex();

    // public
    async getHealthCheckStatus () {

        // return cached result
        if ( this.#healthCheckLastUpdated && this.#healthCheckUpdateInterval && new Date() - this.#healthCheckLastUpdated < this.#healthCheckUpdateInterval ) {
            return this.#healthCheckStatus;
        }

        if ( this.#healthCheckMutex.tryDown() ) {

            // run health check
            try {
                this.#healthCheckStatus = await this.app.getHealthCheckStatus();
            }
            catch ( e ) {
                this.#healthCheckStatus = result( 500 );
            }

            this.#healthCheckLastUpdated = new Date();

            this.#healthCheckMutex.up();

            this.#healthCheckMutex.signal.broadcast();
        }
        else {
            await this.#healthCheckMutex.signal.wait();
        }

        return this.#healthCheckStatus;
    }

    // protected
    async _init () {
        if ( this.api.config.healthCheckUpdateInterval ) this.#healthCheckUpdateInterval = this.api.config.healthCheckUpdateInterval;

        return result( 200 );
    }
}
