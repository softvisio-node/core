import Mutex from "#lib/threads/mutex";

export default class Healthcheck {
    #app;
    #config;
    #components;
    #checkHealthMutex = new Mutex();
    #result;
    #lastChecked;

    constructor ( app, config, components ) {
        this.#app = app;
        this.#config = config;
        this.#components = components;
    }

    // properties
    get app () {
        return this.#app;
    }

    // public
    async checkHealth () {
        if ( this.#result && this.#lastChecked && this.#lastChecked + this.#config.interval * 1000 > Date.now() ) return this.#result;

        if ( !this.#checkHealthMutex.tryLock() ) return this.#checkHealthMutex.wait();

        var res = result( 200 );

        // check components
        for ( const component of this.#components ) {
            res = await component.checkHealth();

            if ( !res.ok ) break;
        }

        // check app
        if ( res.pk ) {
            res = await this.app.checkHealth();
        }

        this.#result = res;
        this.#lastChecked = Date.now();

        this.#checkHealthMutex.unlock( res );

        return res;
    }
}
