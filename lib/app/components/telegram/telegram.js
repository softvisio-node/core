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

    "getBots": sql`SELECT id, type FROM telegram_bot`.prepare(),

    "deleteBot": sql`DELETE FROM telegram_bot WHERE id = ?`.prepare(),
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

    // XXX - set dbh listeners
    async run () {
        const bots = await this.dbh.select( SQL.getBots );
        if ( !bots.ok ) return bots;

        // load bots
        for ( const { id, type } of bots.data || [] ) {
            const botComponent = this.app[type];

            if ( !botComponent ) return result( [500, `Telegram Bot type ${type} not found`] );

            const bot = new botComponent.Bot( this, id );

            const res = await bot.init();
            if ( !res.ok ) return res;

            this.#bots[id] = bot;
        }

        // run bots
        for ( const bot of Object.values( this.#bots ) ) {
            const res = await bot.start();

            if ( !res.ok ) console.log( `Unable to start telegram bot ${bot.id}: ${res}` );
        }

        return result( 200 );
    }

    async getBot ( id ) {
        return this.#bots[id];
    }

    async createStaticBot ( options ) {
        return this.#createBot( options, true );
    }

    async createBot ( options ) {
        return this.#createBot( options, false );
    }

    async deleteBot ( id ) {
        const bot = this.getBot( id );

        if ( !bot ) return result( 200 );

        await bot.stop();

        const res = await this.dbh.do( SQL.deleteBot, [id] );

        if ( res.ok ) delete this.#bots[id];

        return res;
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
