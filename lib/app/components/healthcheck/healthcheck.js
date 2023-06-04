import Mutex from "#lib/threads/mutex";

export default class Healthcheck {
    #app;
    #components;
    #checkHealthMutex = new Mutex();

    constructor ( app, components ) {
        this.#app = app;
        this.#components = components;
    }

    // public
    async checkHealth () {
        if ( !this.#checkHealthMutex.tryLock() ) return this.#checkHealthMutex.wait();

        var res;

        for ( const component of this.#components ) {
            res = await component.checkHealth();

            if ( !res.ok ) break;
        }

        res = await this.app.checkHealth();

        this.#checkHealthMutex.unlock( res );

        return res;
    }
}
