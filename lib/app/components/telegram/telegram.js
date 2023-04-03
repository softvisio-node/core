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

    // public
    async init () {
        var res;

        // init db
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async run () {
        return result( 200 );
    }

    async createBot () {
        const res = await this.#dbh.selectRow( SQL.createBot, [] );

        return res;
    }
}
