import sql from "#lib/sql";

const SQL = {
    "createBot": sql``.prepare(),
};

export default class Telegram {
    #app;
    #config;
    #dbh;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
        this.#dbh = app.dbh;
    }

    // properties
    get app () {
        return this.#app;
    }

    get dbh () {
        return this.#dbh;
    }

    // public
    async init () {
        var res;

        // init db
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    // XXX
    async run () {
        return result( 200 );
    }

    // XXX return bot
    async createBot ( type, apiKey ) {
        const res = await this.#dbh.selectRow( SQL.createBot, [] );

        return res;
    }
}
