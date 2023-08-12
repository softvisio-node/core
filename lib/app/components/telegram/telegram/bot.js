import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import TelegramBotUpdate from "./bot/update.js";
import constants from "#lib/app/constants";
import Mutex from "#lib/threads/mutex";
import TelegramBotUpdater from "./bot/updater.js";
import TelegramBotProcessor from "./bot/processor.js";
import TelegramBotUsers from "./bot/users.js";
import Locales from "#lib/locale/locales";

const SQL = {
    "setStarted": sql`UPDATE telegram_bot SET started = ?, error = ?, error_text = ? WHERE id = ?`.prepare(),

    "createTelegramUser": sql`INSERT INTO telegram_user ( telegram_id, is_bot, username, first_name, last_name, language_code ) VALUES ( ?, ?, ?, ?, ?, ? ) ON CONFLICT ( telegram_id ) DO UPDATE SET username = EXCLUDED.username RETURNING id`.prepare(),

    "createTelegramBotUser": sql`INSERT INTO telegram_bot_user ( telegram_bot_id, telegram_user_id ) VALUES ( ?, ? ) ON CONFLICT ( telegram_bot_id, telegram_user_id ) DO NOTHING RETURNING id`.prepare(),
};

export default class TelegramBot {
    #app;
    #telegram;
    #component;
    #dbh;
    #id;
    #type;
    #isStatic;
    #telegramId;
    #telegramUsername;
    #telegramFirstName;
    #telegramCanJoinGroups;
    #telegramCanReadAllGroupMessages;
    #telegramSupportsInlineQueries;

    #locales;

    #telegramBotApi;
    #started;

    #isShuttingDown = false;
    #updater;
    #processor;
    #users;
    #createUSerMutexes = new Mutex.Set();

    constructor ( telegram, component, id, type, fields ) {
        this.#app = telegram.app;
        this.#telegram = telegram;
        this.#component = component;
        this.#dbh = telegram.dbh;
        this.#id = id;
        this.#type = type;
        this.#isStatic = fields.static;
        this.#telegramId = fields.telegram_id;
        this.#telegramBotApi = new TelegramBotApi( fields.telegram_api_key );

        this.updateTelegramBotFields( fields );

        this.#updater = new TelegramBotUpdater( this );
        this.#processor = new TelegramBotProcessor( this, this.#onTelegramUpdate.bind( this ) );

        this.#users = new TelegramBotUsers( this );
    }

    // properties
    get app () {
        return this.#app;
    }

    get telegram () {
        return this.#telegram;
    }

    get component () {
        return this.#component;
    }

    get config () {
        return this.component.config;
    }

    get dbh () {
        return this.#dbh;
    }

    get type () {
        return this.#type;
    }

    get id () {
        return this.#id;
    }

    get isStatic () {
        return this.#isStatic;
    }

    get telegramId () {
        return this.#telegramId;
    }

    get telegramUsername () {
        return this.#telegramUsername;
    }

    get telegramBotApi () {
        return this.#telegramBotApi;
    }

    get isStarted () {
        return this.#started;
    }

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    get locales () {
        return this.#locales;
    }

    get locale () {
        return this.#component.locale;
    }

    // public
    async start () {
        if ( this.#isShuttingDown ) return;

        if ( !this.#started ) return;

        if ( this.telegram.config.runUpdater ) this.#updater.start();

        if ( this.telegram.config.runProcessor ) this.#processor.start();
    }

    async stop () {
        return Promise.all( [

            //
            this.#updater.stop(),
            this.#processor.stop(),
        ] );
    }

    async shutDown () {
        this.#isShuttingDown = true;

        await this.stop();

        this.#users.destroy();
    }

    async canStart () {
        return result( 200 );
    }

    async updateTelegramData () {
        return this.#updateTelegramData();
    }

    async setStarted ( started, { error } = {} ) {
        if ( started ) {
            var res = await this.canStart();

            if ( !res.ok ) {
                await this.setStatted( false, { "error": res.statusText } );

                return res;
            }
            else {
                res = await this.dbh.do( SQL.setStarted, [true, false, null, this.id] );

                if ( !res.ok ) return res;

                return result( 200 );
            }
        }
        else {
            const res = await this.dbh.do( SQL.setStarted, [false, !!error, error, this.id] );

            if ( !res.ok ) return res;

            return result( 200 );
        }
    }

    async setApiKey ( apiKey ) {
        return this.#updateTelegramData( apiKey );
    }

    get users () {
        return this.#users;
    }

    updateTelegramBotFields ( fields ) {
        if ( "telegram_api_key" in fields ) this.#telegramBotApi.apiKey = fields.telegram_api_key;

        if ( "telegram_username" in fields ) this.#telegramUsername = fields.telegram_username;

        if ( "telegram_first_name" in fields ) this.#telegramFirstName = fields.telegram_first_name;

        if ( "telegram_can_join_groups" in fields ) this.#telegramCanJoinGroups = fields.telegram_can_join_groups;

        if ( "telegram_can_read_all_group_messages" in fields ) this.#telegramCanReadAllGroupMessages = fields.telegram_can_read_all_group_messages;

        if ( "telegram_supports_inline_queries" in fields ) this.#telegramSupportsInlineQueries = fields.telegram_supports_inline_queries;

        if ( "started" in fields ) {
            const oldValue = this.#started;
            this.#started = fields.started;

            if ( oldValue != null ) {
                if ( this.#started ) {
                    this.start();
                }
                else {
                    this.stop();
                }
            }
        }

        if ( "locales" in fields ) {
            if ( !fields.locales?.length ) {
                this.#locales = this.#component.locales;
            }
            else {
                this.#locales = new Locales( this.#component.locales.merge( fields.locales ) );
            }

            this.#users?.clear();
        }
    }

    // protected
    async _createUser ( dbh, telegramBotUserId ) {
        return result( 200 );
    }

    // private
    // XXX
    async #onTelegramUpdate ( update, signal ) {
        console.log( "---", update.data.chat.type );

        // private chat
        if ( update.data.chat?.type === "private" ) {
            return this.#privateChatUpdate( update, signal );
        }

        // channel
        else if ( update.data.chat?.type === "channel" ) {

            // XXX
        }

        // supergroup
        else if ( update.data.chat?.type === "supergroup" ) {

            // XXX
        }
    }

    // XXX
    async #privateChatUpdate ( update, signal ) {
        update = new TelegramBotUpdate( this, signal, update );

        // private chat with user
        if ( update.data.chat?.type === "private" && update.data.from ) {
            let user = await this.#users.getByTelegramId( update.data.from.id );

            // create user
            if ( !user ) {
                await this.#createUser( update.data.from );

                user = await this.#users.getByTelegramId( update.data.from.id );
            }

            // update user
            else {
                await user.setTelegramFields( update.data.from );

                if ( !user.isSubscribed ) await user.setSubscribed( true );
            }

            update.user = user;
        }

        // aborted
        if ( signal.aborted ) return;

        // my_chat_member
        if ( update.isMyChatMember ) {
            if ( update.user ) {
                if ( update.data.new_chat_member.status === "member" ) {
                    if ( !update.user.isSubscribed ) await update.user.setSubscribed( true );
                }
                else if ( update.data.new_chat_member.status === "kicked" ) {
                    if ( update.user.isSubscribed ) await update.user.setSubscribed( false );
                }
            }
        }

        // messagge
        else if ( update.type === "message" ) {

            // /start with parameter
            if ( update.data.text?.startsWith( "/start " ) ) {
                let params;

                // decode parameter
                try {
                    params = JSON.parse( Buffer.from( update.data.text.substring( 7 ), "base64url" ) );
                }
                catch ( e ) {}

                // link api user
                if ( params?.apiUserToken ) {
                    await this.#linkUser( update, params.apiUserToken );
                }
            }
        }

        await this._update( update );
    }

    async #updateTelegramData ( apiKey ) {

        // api key not changed
        if ( apiKey && apiKey === this.#telegramBotApi.apiKey ) return result( 200 );

        const api = apiKey ? new TelegramBotApi( apiKey ) : this.#telegramBotApi;

        var res = await api.send( "getMe" );
        if ( !res.ok ) return res;

        if ( res.data.id + "" !== this.#telegramId ) return result( [401, `Api key is not valid`] );

        var fields = new Map();

        if ( apiKey ) fields.set( "telegram_api_key", apiKey );
        if ( this.#telegramUsername !== res.data.username ) fields.set( "telegram_username", res.data.username );
        if ( this.#telegramFirstName !== res.data.first_name ) fields.set( "telegram_first_name", res.data.first_name );
        if ( this.#telegramCanJoinGroups !== res.data.can_join_groups ) fields.set( "telegram_can_join_groups", res.data.can_join_groups );
        if ( this.#telegramCanReadAllGroupMessages !== res.data.can_read_all_group_messages ) fields.set( "telegram_can_read_all_group_messages", res.data.can_read_all_group_messages );
        if ( this.#telegramSupportsInlineQueries !== res.data.supports_inline_queries ) fields.set( "telegram_supports_inline_queries", res.data.supports_inline_queries );

        // nothis to update
        if ( !fields.size ) return result( 200 );

        fields = Object.fromEntries( fields.entries() );

        res = await this.dbh.do( sql`UPDATE telegram_bot`.SET( fields ).sql`WHERE id = ${this.#id}` );
        if ( !res.ok ) return res;

        this.updateTelegramBotFields( fields );

        return result( 200 );
    }

    async #linkUser ( update, token ) {
        return this.dbh.begin( async dbh => {
            var res = await this.app.actionTokens.activateActionToken( token, constants.tokenTypeLinkTelegramAccount, { dbh } );
            if ( !res.ok ) throw result( [400, `Unable to link user. Token is not valid. Please, try agin.`] );

            const apiUserId = res.data.userId;

            res = await update.user.setApiUserId( apiUserId );
            if ( !res.ok ) throw res;

            return res;
        } );
    }

    async #createUser ( options ) {
        const mutex = this.#createUSerMutexes.get( options.id );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this.dbh.begin( async dbh => {
            var res = await dbh.selectRow( SQL.createTelegramUser, [

                //
                options.id,
                options.is_bot,
                options.username,
                options.first_name,
                options.last_name,
                options.language_code,
            ] );

            if ( !res.ok ) throw res;

            const telegramUserId = res.data.id;

            res = await dbh.selectRow( SQL.createTelegramBotUser, [

                //
                this.id,
                telegramUserId,
            ] );

            if ( !res.ok ) throw res;

            const telegramBotUserId = res.data.id;

            if ( !telegramBotUserId ) throw `User already exists`;

            res = await this._createUser( dbh, telegramBotUserId );

            if ( !res.ok ) throw res;
        } );

        mutex.unlock( res );

        return res;
    }
}
