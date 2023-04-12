import sql from "#lib/sql";
import TelegramBot from "./bot.js";

const SQL = {
    "getBot": sql`SELECT * FROM telegram_bot WHERE id = ?`.prepare(),
};

export default class {
    #app;
    #config;
    #dbh;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
        this.#dbh = app.dbh;
    }

    // public
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dbh () {
        return this.#dbh;
    }

    get Bot () {
        return TelegramBot;
    }

    // public
    async init () {
        return this._init();
    }

    async run () {
        return this._run();
    }

    async newBot ( id ) {
        var res;

        res = await this._getNewBotOptions( id );
        if ( !res.ok ) return res;

        const bot = new this.Bot( res.data );

        res = await bot.init();
        if ( !res.ok ) return res;

        return result( 200, bot );
    }

    async createBot ( dbh, id, options ) {
        return this._createBot( dbh, id, options );
    }

    // protected
    async _init () {
        return result( 200 );
    }

    async _run () {
        return result( 200 );
    }

    async _getNewBotOptions ( id ) {
        return this.dbh.selectRow( SQL.getBot, [id] );
    }

    async _createBot ( dbh, id, options ) {
        return result( 200 );
    }
}
