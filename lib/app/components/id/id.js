export default class id {
    #app;
    #config;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get clusterId () {
        return this.#config.clusterId;
    }

    // public
    async init () {
        return result( 200 );
    }
}
