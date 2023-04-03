import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import TelegramBot from "./telegram/bot.js";

const SQL = {
    "getBotById": sql`SELECT * FROM telegram_bot WHERE id = ?`.prepare(),

    "getBotByTelegramId": sql`SELECT * FROM telegram_bot WHERE telegram_id = ?`.prepare(),

    "upsertBot": sql`
INSERT INTO telegram_bot
    ( type, api_key, telegram_id, telegram_username, telegram_name )
VALUES
    ( ?, ?, ?, ?, ? )
ON CONFLICT ( telegram_id ) DO UPDATE SET
    api_key = EXCLUDED.api_key,
    telegram_username = EXCLUDED.telegram_username,
    telegram_name = EXCLUDED.telegram_name
RETURNING
    id
`.prepare(),

    "createBot": sql`SELECT 1`.prepare(),
};

export default class Telegram {
    #app;
    #config;
    #dbh;
    #bots = {};

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
    async getBot ( id ) {
        var bot = this.#bots[id];

        if ( bot ) return bot;

        const res = await this.dbh.selectRow( SQL.getBotById, [id] );
        if ( !res.ok ) return;

        bot = new TelegramBot( this, {
            "id": res.data.id,
            "type": res.data.type,
            "apiKey": res.data.api_key,
            "telegramId": res.data.telegram_id,
            "telegramUsername": res.data.telegram_username,
            "telegramName": res.data.telegram_name,
        } );

        this.#bots[bot.id] = bot;

        return bot;
    }

    // XXX return bot
    async createBot ( type, apiKey ) {
        var res;

        const telegramBotApi = new TelegramBotApi( apiKey );

        const bot = await telegramBotApi.send( "getMe" );
        if ( !bot.ok ) return bot;

        res = await this.dbh.selectRow( SQL.getBotByTelegramId, [bot.data.id] );
        if ( !res.ok ) return res;

        // bot already exists
        if ( res.data ) {

            // bot id was updated
            if ( res.data.type !== type ) {

                // bot type is not the same
                return result( [500, "Telegram bot already exists with the different type"] );
            }
        }

        // upsert bot
        res = await this.dbh.selectRow( SQL.upsertBot, [

            //
            type,
            apiKey,
            bot.data.id,
            bot.data.username,
            bot.data.first_name,
        ] );

        if ( !res.ok ) return res;

        return result( [200, { "id": res.data.id }] );
    }
}
