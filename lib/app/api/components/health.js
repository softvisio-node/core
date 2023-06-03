import Component from "#lib/app/api/component";
import Mutex from "#lib/threads/mutex";

export default class extends Component {
    #healthCheckStatus;
    #healthCheckUpdateInterval = 10_000;
    #healthCheckLastUpdated;
    #healthCheckMutex = new Mutex();

    // public
    async healthCheck () {

        // return cached result
        if ( this.#healthCheckLastUpdated && this.#healthCheckUpdateInterval && new Date() - this.#healthCheckLastUpdated < this.#healthCheckUpdateInterval ) {
            return this.#healthCheckStatus;
        }

        if ( !this.#healthCheckMutex.tryLock() ) return this.#healthCheckMutex.wait();

        // run health check
        try {
            this.#healthCheckStatus = await this.app.healthCheck();
        }
        catch ( e ) {
            this.#healthCheckStatus = result( 500 );
        }

        this.#healthCheckLastUpdated = new Date();

        this.#healthCheckMutex.unlock( this.#healthCheckStatus );

        return this.#healthCheckStatus;
    }
}
