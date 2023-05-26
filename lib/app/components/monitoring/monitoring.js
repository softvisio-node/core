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
    async init () {
        var res;

        // migrate database
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async run () {}

    async shutDown () {}

    async monitorCall ( component, callIs, method ) {
        return await method();
    }
}
