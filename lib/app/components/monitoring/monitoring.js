export default class Monitoring {
    #app;
    #config;
    #dbh;
    #enabled;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;

        this.#dbh = this.#app.dbh;
        this.#enabled = this.#config.enabled && this.#dbh;
    }

    // publuc
    async init () {}

    async run () {}

    async shutDown () {}

    async logCall ( component, callIs, method ) {
        return await method();
    }
}
