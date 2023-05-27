import Cache from "./users/cache";

export default class {
    #app;
    #config;
    #cache;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
    }

    // properties
    get app () {
        return this.#app;
    }

    get dbh () {
        return this.#app.dbh;
    }

    get config () {
        return this.#config;
    }

    get cache () {
        return this.#cache;
    }

    // public
    async init () {
        var res;

        // migrate database
        res = await this.dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        this.#cache = new Cache( this.app, this.config.cacheMaxSize );

        res = await this.#cache.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }
}
