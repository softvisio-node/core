import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import msgpack from "#lib/msgpack";

const SQL = {
    "lockCreateBot": sql`SELECT pg_advisory_xact_lock( get_lock_id( 'telegram/telegram-bot/create' ) )`.prepare(),

    "getBotByTelegramId": sql`SELECT * FROM telegram_bot WHERE telegram_id = ?`.prepare(),

    "upsertBot": sql`
INSERT INTO telegram_bot (
    type,
    static,
    name,
    short_description,
    description,
    telegram_api_key,
    telegram_id,
    telegram_username,
    telegram_can_join_groups,
    telegram_can_read_all_group_messages,
    telegram_supports_inline_queries,
    started
)
VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )
ON CONFLICT ( telegram_id ) DO UPDATE set
    name = EXCLUDED.name,
    short_description = EXCLUDED.short_description,
    description = EXCLUDED.description,
    telegram_api_key = EXCLUDED.telegram_api_key,
    telegram_username = EXCLUDED.telegram_username,
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
    #component;
    #config;
    #dbh;
    #bots = {};
    #isShuttingDown;
    #unloading;

    constructor ( app, component, config ) {
        this.#app = app;
        this.#component = component;
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

    get config () {
        return this.#config;
    }

    get locale () {
        return this.#component.locale;
    }

    // public
    async init () {
        var res;

        // init db
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ) );
        if ( !res.ok ) return res;

        this.app.publicHttpServer?.get( this.config.downloadFilesLocation, this.#downloadFile.bind( this ) );

        return result( 200 );
    }

    async start () {
        this.dbh.on( "connect", this.#loadBots.bind( this ) );

        this.dbh.on( "disconnect", this.#unloadBots.bind( this ) );

        this.dbh.on( "telegram/telegram-bot/create", data => this.#loadBot( data.id, data.type )?.start() );

        this.dbh.on( "telegram/telegram-bot/update", data => this.getBot( data.id )?.updateTelegramBotFields( data ) );

        this.dbh.on( "telegram/telegram-bot/delete", data => this.#deleteBot( data.id ) );

        await this.#loadBots();

        return result( 200 );
    }

    async shutDown () {
        this.#isShuttingDown = true;

        return this.#unloadBots();
    }

    getBot ( id ) {
        return this.#bots[id];
    }

    async createStaticBot ( options ) {
        return this.#createBot( options, true );
    }

    async createBot ( options ) {
        return this.#createBot( options, false );
    }

    async deleteBot ( id ) {
        const bot = this.#bots[id];

        if ( !bot ) return result( 200 );

        if ( bot.isStatic ) return result( [500, `Unable to delete static bot`] );

        const res = await this.dbh.do( SQL.deleteBot, [id] );

        if ( res.ok ) await this.#deleteBot( id );

        return res;
    }

    encodeCallback ( method, ...args ) {
        const value = msgpack.encode( [method, ...args], "base64url" );

        if ( value.length > 64 ) throw Error( `Telegram callback data length > 64 bytes` );

        return value;
    }

    decodeCallback ( string ) {
        try {
            const [method, ...args] = msgpack.decode( string, "base64url" );

            return {
                method,
                args,
            };
        }
        catch ( e ) {}
    }

    // private
    async #loadBots () {
        if ( this.#isShuttingDown ) return;
        if ( this.#unloading ) return;
        if ( !this.dbh.isConnected ) return;

        const bots = await this.dbh.select( SQL.getBots );
        if ( !bots.ok ) return bots;

        // load bots
        for ( const { id, type } of bots.data || [] ) {
            await this.#loadBot( id, type );
        }

        // start bots
        for ( const bot of Object.values( this.#bots ) ) {
            bot.start();
        }
    }

    async #unloadBots () {
        this.#unloading = true;

        const bots = this.#bots;
        this.#bots = {};

        await Promise.all( Object.values( bots ).map( bot => bot.shutDown() ) );

        this.#unloading = false;

        this.#loadBots();
    }

    async #deleteBot ( id ) {
        const bot = this.#bots[id];

        if ( !bot ) return result( 200 );

        delete this.#bots[id];

        return bot.shutDown();
    }

    async #createBot ( options, isStatic ) {
        const botComponent = this.app.components.get( options.type );
        if ( !botComponent ) return result( [400, `Bot type is not valid`] );

        const telegramBotApi = new TelegramBotApi( options.apiKey );

        var fields = {},
            res;

        res = await telegramBotApi.getMe();
        if ( !res.ok ) return res;
        fields = res.data;

        res = await telegramBotApi.getMyShortDescription();
        if ( !res.ok ) return res;
        fields.short_description = res.data.short_description;

        res = await telegramBotApi.getMyDescription();
        if ( !res.ok ) return res;
        fields.description = res.data.description;

        const bot = await this.dbh.selectRow( SQL.getBotByTelegramId, [fields.id] );
        if ( !bot.ok ) return bot;

        // bot with the required telegram id already exists
        if ( bot.data ) {

            // bot is not static
            if ( !isStatic ) return result( [400, `Bot already exists`] );

            // existsing bot is not static
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
                !!isStatic, // static
                fields.first_name, // name
                fields.short_description,
                fields.description,
                options.apiKey, //     telegram_api_key
                fields.id, // telegram_id
                fields.username, // telegram_username
                fields.can_join_groups, // telegram_can_join_groups
                fields.can_read_all_group_messages, // telegram_can_read_all_group_messages
                fields.supports_inline_queries, // telegram_supports_inline_queries
                options.started ?? true, // started
            ] );
            if ( !res.ok ) throw res;

            const id = res.data.id;

            res = await botComponent.createBot( dbh, id, options );
            if ( !res.ok ) throw res;

            return result( 200, { id } );
        } );
    }

    async #loadBot ( id, type ) {
        if ( this.#bots[id] ) return this.#bots[id];

        const botComponent = this.app.components.get( type );

        if ( !botComponent ) return;

        const fields = await botComponent.getBotFields( id );

        const bot = new botComponent.Bot( this, botComponent, id, type, fields );

        const res = await bot.init();
        if ( !res.ok ) return;

        this.#bots[id] = bot;

        return bot;
    }

    async #downloadFile ( req ) {
        const [botId, fileId] = req.url.pathname.split( "/" ).slice( 4, 6 );

        if ( !botId || !fileId ) return req.end( 404 );

        const bot = this.getBot( botId );

        if ( !bot ) return req.end( 404 );

        return bot.downloadFile( req, fileId );
    }
}
