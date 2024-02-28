import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import msgpack from "#lib/msgpack";

const SQL = {
    "lockCreateBot": sql`SELECT pg_advisory_xact_lock( get_lock_id( 'telegram/telegram-bot/create' ) )`.prepare(),

    "getBotByTelegramId": sql`
SELECT
    telegram_bot.*,
    telegram_bot_api_token.api_token AS telegram_bot_api_token
FROM
    telegram_bot
    LEFT JOIN telegram_bot_api_token ON ( telegram_bot.id = telegram_bot_api_token.telegram_bot_id )
WHERE telegram_bot.id = ?
`.prepare(),

    "insertBot": sql`
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
ON CONFLICT DO NOTHING
RETURNING id, acl_id
`.prepare(),

    "updateBot": sql`
UPDATE telegram_bot SET
    locales = ?,
    default_locale = ?,
    name = ?,
    short_description = ?,
    description = ?,
    username = ?,
    telegram_can_join_groups = ?,
    telegram_can_read_all_group_messages = ?,
    telegram_supports_inline_queries = ?
WHERE
    id = ?
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

export default class Telegram {
    #app;
    #component;
    #config;
    #dbh;
    #bots = {};
    #isShuttingDown;
    #unloading;
    #telegramComponents = new Map();

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

    get telegramComponents () {
        return this.#telegramComponents;
    }

    // public
    async init () {
        var res;

        // init db
        res = await this.#dbh.schema.migrate( new URL( "db", import.meta.url ), {
            "app": this.app,
        } );
        if ( !res.ok ) return res;

        this.app.publicHttpServer?.get( this.config.filesUrl + "*", this.#downloadFile.bind( this ) );

        this.app.publicHttpServer?.get( this.config.avatarUrl + "*", this.#downloadAvatar.bind( this ) );

        return result( 200 );
    }

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

        this.dbh.on( "telegram/telegram-bot/create", async data => {
            const bot = await this.#loadBot( data.id, data.type );

            if ( bot ) bot.start();
        } );

        this.dbh.on( "telegram/telegram-bot/update", data => this.getBot( data.id )?.updateTelegramBotFields( data ) );

        this.dbh.on( "telegram/telegram-bot/deleted/update", async data => {
            if ( data.deleted ) {
                this.#deleteBot( data.id );
            }
            else {
                const bot = await this.#loadBot( data.id, data.type );

                if ( bot ) bot.start();
            }
        } );

        await this.#loadBots();

        return result( 200 );
    }

    async shutDown () {
        this.#isShuttingDown = true;

        return this.#unloadBots();
    }

    registerComponent ( component ) {
        this.#telegramComponents.set( component.name, component );
    }

    getBot ( id ) {
        return this.#bots[ id ];
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

        if ( res.ok ) await this.#deleteBot( id );

        return res;
    }

    encodeCallbackData ( method, ...args ) {
        const value = msgpack.encode( [ method, ...args ], "base64url" );

        if ( value.length > 64 ) throw Error( `Telegram callback data length > 64 bytes` );

        return value;
    }

    decodeCallbackData ( string ) {
        try {
            return msgpack.decode( string, "base64url" );
        }
        catch ( e ) {
            return null;
        }
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
        const bot = this.#bots[ id ];

        if ( !bot ) return result( 200 );

        delete this.#bots[ id ];

        return bot.shutDown();
    }

    async #createBot ( options, isStatic ) {
        const botComponent = this.app.components.get( options.type );
        if ( !botComponent ) return result( [ 400, `Bot type is not valid` ] );

        const telegramBotApi = new TelegramBotApi( options.apiToken );

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

        const bot = await this.dbh.selectRow( SQL.getBotByTelegramId, [ fields.id ] );
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

            // update
            res = await dbh.selectRow( SQL.updateBot, [

                //
                options.locales,
                options.defaultLocale,
                fields.first_name, // name
                fields.short_description,
                fields.description,
                fields.username, // username
                fields.can_join_groups, // telegram_can_join_groups
                fields.can_read_all_group_messages, // telegram_can_read_all_group_messages
                fields.supports_inline_queries, // telegram_supports_inline_queries
                fields.id, // telegram id
            ] );
            if ( !res.ok ) throw res;

            // insert
            if ( !res.data ) {
                res = await dbh.selectRow( SQL.insertBot, [
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
            }

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

            res = await botComponent.createBot( dbh, id, options );
            if ( !res.ok ) throw res;

            return result( 200, { id } );
        } );
    }

    async #loadBot ( id, type ) {
        if ( this.#bots[ id ] ) return this.#bots[ id ];

        const botComponent = this.app.components.get( type );

        if ( !botComponent ) return;

        var res;

        res = await this.dbh.selectRow( SQL.loadBot, [ id ] );
        if ( !res.ok ) {
            console.error( `Unable to loaf bot type: ${ type }, error: ${ res }` );

            return;
        }

        const bot = new botComponent.Bot( this, botComponent, id, type, res.data );

        res = await bot.init();
        if ( !res.ok ) {
            console.error( `Unable to loaf bot type: ${ type }, error: ${ res }` );

            return;
        }

        this.#bots[ id ] = bot;

        return bot;
    }

    async #downloadFile ( req ) {
        const [ botId, fileId ] = req.path.substring( this.config.filesUrl.length ).split( "/" );

        if ( !botId || !fileId ) return req.end( 404 );

        const bot = this.getBot( botId );

        if ( !bot ) return req.end( 404 );

        return bot.files.downloadFile( req, fileId );
    }

    async #downloadAvatar ( req ) {
        const [ botId, userId ] = req.path.substring( this.config.avatarUrl.length ).split( "/" );

        if ( !botId ) return req.end( 404 );

        const bot = this.getBot( botId );

        if ( !bot ) return req.end( 404 );

        if ( userId ) {
            try {
                BigInt( userId );
            }
            catch ( e ) {
                return req.end( 404 );
            }
        }

        return bot.files.downloadAvatar( req, userId );
    }
}
