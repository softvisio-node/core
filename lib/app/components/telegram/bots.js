import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";

const SQL = {
    "lockCreateBot": sql`SELECT pg_advisory_xact_lock( get_lock_id( 'telegram/telegram-bot/create' ) )`.prepare(),

    "getBotById": sql`
SELECT
    telegram_bot.*,
    telegram_bot_api_token.api_token AS telegram_bot_api_token
FROM
    telegram_bot
    LEFT JOIN telegram_bot_api_token ON ( telegram_bot.id = telegram_bot_api_token.telegram_bot_id )
WHERE telegram_bot.id = ?
`.prepare(),

    "upsertBot": sql`
INSERT INTO telegram_bot (
    id,
    acl_id,
    type,
    static,
    locales,
    default_locale,
    name,
    short_description,
    description,
    username,
    telegram_can_join_groups,
    telegram_can_read_all_group_messages,
    telegram_supports_inline_queries,
    started
)
VALUES ( ?, create_acl( ? ), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )
ON CONFLICT ( id ) DO UPDATE SET
    locales = EXCLUDED.locales,
    default_locale = EXCLUDED.default_locale,
    name = EXCLUDED.name,
    short_description = EXCLUDED.short_description,
    description = EXCLUDED.description,
    username = EXCLUDED.username,
    telegram_can_join_groups = EXCLUDED.telegram_can_join_groups,
    telegram_can_read_all_group_messages = EXCLUDED.telegram_can_read_all_group_messages,
    telegram_supports_inline_queries = EXCLUDED.telegram_supports_inline_queries
RETURNING id, acl_id
`.prepare(),

    "upsertApiToken": sql`
INSERT INTO
    telegram_bot_api_token
( telegram_bot_id, api_token ) VALUES ( ?, ? )
ON CONFLICT ( telegram_bot_id ) DO UPDATE SET api_token = EXCLUDED.api_token
`.prepare(),

    "getBots": sql`SELECT id, type FROM telegram_bot WHERE deleted = FALSE`.prepare(),

    "deleteBot": sql`UPDATE telegram_bot SET deleted = TRUE, deletion_date = CURRENT_TIMESTAMP WHERE id = ?`.prepare(),

    "loadBot": sql`
SELECT
    row_to_json( telegram_bot ) AS telegram_bot,
    telegram_bot_api_token.api_token AS telegram_bot_api_token
FROM
    telegram_bot
    LEFT JOIN telegram_bot_api_token ON ( telegram_bot.id = telegram_bot_api_token.telegram_bot_id )
WHERE
    telegram_bot.id = ?
`.prepare(),
};

export default class {
    #telegram;
    #bots = {};
    #telegramComponents = new Map();
    #unloading;
    #isShuttingDown;

    constructor ( telegram ) {
        this.#telegram = telegram;
    }

    // properties
    get telegram () {
        return this.#telegram;
    }

    get app () {
        return this.#telegram.app;
    }

    get config () {
        return this.#telegram.config;
    }

    get dbh () {
        return this.#telegram.dbh;
    }

    get telegramComponents () {
        return this.#telegramComponents;
    }

    // public
    async start () {

        // create static bots
        if ( this.config.bots ) {
            for ( const bot of this.config.bots ) {
                const res = await this.createStaticBot( bot );

                if ( !res.ok ) return res;
            }
        }

        this.dbh.on( "connect", this.#loadBots.bind( this ) );

        this.dbh.on( "disconnect", this.#unloadBots.bind( this ) );

        this.dbh.on( "telegram/telegram-bot/create", data => {
            this.#loadAndStartBot( data.id, data.type );
        } );

        this.dbh.on( "telegram/telegram-bot/update", data => this.getBotById( data.id )?.updateTelegramBotFields( data ) );

        this.dbh.on( "telegram/telegram-bot/deleted/update", data => {

            // unload bot
            if ( data.deleted ) {
                this.#unloadBot( data.id );
            }

            // load and start bot
            else {
                this.#loadAndStartBot( data.id, data.type );
            }
        } );

        // load bots
        const res = await this.#loadBots();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async shutDown () {
        this.#isShuttingDown = true;

        return this.#unloadBots();
    }

    getBotById ( id ) {
        return this.#bots[ id ];
    }

    registerComponent ( component ) {
        this.#telegramComponents.set( component.id, component );
    }

    async createStaticBot ( options ) {
        return this.#createBot( options, true );
    }

    async createBot ( options ) {
        return this.#createBot( options, false );
    }

    async deleteBot ( id ) {
        const bot = this.#bots[ id ];

        if ( !bot ) return result( 200 );

        if ( bot.isStatic ) return result( [ 500, `Unable to delete static bot` ] );

        const res = await this.dbh.do( SQL.deleteBot, [ id ] );

        if ( res.ok ) await this.#unloadBot( id );

        return res;
    }

    // private
    async #createBot ( options, isStatic ) {
        const botComponent = this.app.components.get( options.type );
        if ( !botComponent ) return result( [ 400, `Bot type is not valid` ] );

        const api = new TelegramBotApi( options.apiToken );

        var fields = {},
            res;

        res = await api.getMe();
        if ( !res.ok ) return res;
        fields = res.data;

        res = await api.getMyShortDescription();
        if ( !res.ok ) return res;
        fields.short_description = res.data.short_description;

        res = await api.getMyDescription();
        if ( !res.ok ) return res;
        fields.description = res.data.description;

        const bot = await this.dbh.selectRow( SQL.getBotById, [ fields.id ] );
        if ( !bot.ok ) return bot;

        // bot with the required telegram id already exists
        if ( bot.data ) {

            // bot is not static
            if ( !isStatic ) return result( [ 400, `Bot already exists` ] );

            // existsing bot is not static
            if ( !bot.data.static ) return result( [ 500, `Unable to create static bot` ] );

            // extisting bot type is not valid
            if ( bot.data.type !== options.type ) result( [ 500, `Unable to create static bot` ] );
        }

        return this.dbh.begin( async dbh => {
            var res;

            // lock transaction
            res = await dbh.selectRow( SQL.lockCreateBot );
            if ( !res.ok ) throw res;

            // upsert
            res = await dbh.selectRow( SQL.upsertBot, [
                fields.id, // telegram id
                botComponent.aclType,
                options.type, // type
                !!isStatic, // static
                options.locales,
                options.defaultLocale,
                fields.first_name, // name
                fields.short_description,
                fields.description,
                fields.username, // username
                fields.can_join_groups, // telegram_can_join_groups
                fields.can_read_all_group_messages, // telegram_can_read_all_group_messages
                fields.supports_inline_queries, // telegram_supports_inline_queries
                options.started ?? true, // started
            ] );
            if ( !res.ok ) throw res;

            const id = res.data.id,
                aclId = res.data.acl_id;

            // upsert api token
            res = await dbh.do( SQL.upsertApiToken, [ id, this.app.crypto.encrypt( options.apiToken ) ] );
            if ( !res.ok ) throw res;

            if ( options.ownerUserId ) {
                res = await this.app.acl.addAclUser( aclId, options.ownerUserId, {
                    "enabled": true,
                    "roles": [ "owner" ],
                    dbh,
                } );
                if ( !res.ok ) throw res;
            }

            res = await botComponent.createBot( dbh, id, { ...options, fields } );
            if ( !res.ok ) throw res;

            return result( 200, { id } );
        } );
    }

    async #loadBots () {
        if ( this.#isShuttingDown ) return result( 200 );
        if ( this.#unloading ) return result( 200 );

        const bots = await this.dbh.select( SQL.getBots );
        if ( !bots.ok ) return bots;

        // load bots
        for ( const { id, type } of bots.data || [] ) {
            const res = await this.#loadBot( id, type );
            if ( !res.ok ) return res;
        }

        // start bots
        for ( const bot of Object.values( this.#bots ) ) {
            const res = await bot.start();
            if ( !res.ok ) return res;
        }

        return result( 200 );
    }

    async #loadAndStartBot ( botId, botType ) {
        const res = await this.#loadBot( botId, botType );

        if ( !res.ok ) {
            console.warn( `Failed to load bot: ${ res }` );

            return res;
        }
        else {
            const res = await this.getBotById( botId ).start();

            if ( !res.ok ) {
                console.warn( `Failed to start bot: ${ res }` );

                return res;
            }

            return result( 200 );
        }
    }

    async #loadBot ( id, type ) {
        if ( this.#bots[ id ] ) return result( 200 );

        const botComponent = this.app.components.get( type );

        if ( !botComponent ) return result( [ 500, `Bot component not found: ${ type }` ] );

        var res;

        res = await this.dbh.selectRow( SQL.loadBot, [ id ] );
        if ( !res.ok ) {
            return result( [ 500, `Unable to load bot type: ${ type }, error: ${ res }` ] );
        }

        const bot = new botComponent.Bot( this.telegram, botComponent, id, type, res.data );

        res = await bot.init();
        if ( !res.ok ) {
            return result( [ 500, `Unable to load bot type: ${ type }, error: ${ res }` ] );
        }

        this.#bots[ id ] = bot;

        return result( 200 );
    }

    async #unloadBots () {
        this.#unloading = true;

        const bots = this.#bots;
        this.#bots = {};

        await Promise.all( Object.values( bots ).map( bot => bot.shutDown() ) );

        this.#unloading = false;

        this.#loadBots();
    }

    async #unloadBot ( id ) {
        const bot = this.#bots[ id ];

        if ( !bot ) return result( 200 );

        delete this.#bots[ id ];

        return bot.shutDown();
    }
}
