import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";

const SQL = {
    "lockCreateBot": sql`SELECT pg_advisory_xact_lock( get_lock_id( 'telegram/create-bot' ) )`.prepare(),

    "getBotByTelegramId": sql`SELECT * FROM telegram_bot WHERE telegram_id = ?`.prepare(),

    "upsertBot": sql`
INSERT INTO telegram_bot (
    type,
    telegram_api_key,
    telegram_id,
    telegram_username,
    telegram_first_name,
    telegram_can_join_groups,
    telegram_can_read_all_group_messages,
    telegram_supports_inline_queries,
    static,
    enabled
)
VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )
ON CONFLICT ( telegram_id ) DO UPDATE set
    telegram_api_key = EXCLUDED.telegram_api_key,
    telegram_username = EXCLUDED.telegram_username,
    telegram_first_name = EXCLUDED.telegram_first_name,
    telegram_can_join_groups = EXCLUDED.telegram_can_join_groups,
    telegram_can_read_all_group_messages = EXCLUDED.telegram_can_read_all_group_messages,
    telegram_supports_inline_queries = EXCLUDED.telegram_supports_inline_queries
RETURNING id
`.prepare(),

    "getBotById": sql`SELECT * FROM telegram_bot WHERE id = ?`.prepare(),
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

        const TelegramBot = this.app[res.data.type]?.Bot;

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

    async createStaticBot ( options ) {
        return this.#createBot( options, true );
    }

    async createBot ( options ) {
        return this.#createBot( options, false );
    }

    // private
    async #createBot ( options, isStatic ) {
        const botComponent = this.app[options.type];
        if ( !botComponent ) return result( [400, `Bot type is not valid`] );

        const telegramBotApi = new TelegramBotApi( options.apiKey );

        const botData = await telegramBotApi.send( "getMe" );
        if ( !botData.ok ) return bot;

        const bot = await this.dbh.selectRow( SQL.getBotByTelegramId, [botData.data.id] );
        if ( !bot.ok ) return bot;

        // bot with the required telegram id already exists
        if ( bot.data ) {

            // bot is not static
            if ( !isStatic ) return result( [400, `Bot already exists`] );

            // extstsing bot is not static
            if ( !bot.data.static ) return result( [500, `Unable to create static bot`] );

            // extisting bot type is not valid
            if ( bot.data.type !== options.type ) result( [500, `Unable to create static bot`] );
        }

        return this.dbh.begin( async dbh => {
            var res;

            // lock transaction
            res = await dbh.selectRow( SQL.lockCreateBot );
            if ( !res.ok ) throw res;

            res = await dbh.selectRow( SQL.upsertBot, [
                options.type, // type
                options.apiKey, //     telegram_api_key
                botData.data.id, // telegram_id
                botData.data.username, // telegram_username
                botData.data.first_name, // telegram_first_name
                botData.data.can_join_groups, // telegram_can_join_groups
                botData.data.can_read_all_group_messages, // telegram_can_read_all_group_messages
                botData.data.supports_inline_queries, // telegram_supports_inline_queries
                !!isStatic, // static
                options.enabled ?? true, // enabled
            ] );
            if ( !res.ok ) throw res;

            const id = res.data.id;

            res = await botComponent.createBot( dbh, id, options );
            if ( !res.ok ) throw res;

            return result( 200, { id } );
        } );
    }
}
