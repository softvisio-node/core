import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import TelegramBot from "./telegram/bot.js";

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

    // XXX
    async getBot ( id ) {}

    // XXX return bot
    async createBot ( type, apiKey ) {
        const api = new TelegramBotApi( apiKey );

        if ( !api ) throw api;

        const res = await this.#dbh.selectRow( SQL.createBot, [] );
        if ( !res.ok ) return res;

        console.log( "----------", type, apiKey );

        const bot = new TelegramBot( this, 1, apiKey );

        return bot;
    }
}
