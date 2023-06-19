import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import TelegramBotUpdate from "./bot/update.js";
import constants from "#lib/app/constants";
import Mutex from "#lib/threads/mutex";
import TelegramBotGetUpdates from "./bot/get-updates.js";
import TelegramBotProcessUpdates from "./bot/process-updates.js";
import TelegramBotUsers from "./bot/users.js";

const SQL = {
    "init": sql`SELECT * FROM telegram_bot WHERE id = ?`.prepare(),

    "updateStarted": sql`UPDATE telegram_bot SET started = ?, error = ?, error_text = ? WHERE id = ?`.prepare(),

    "linkUser": sql`UPDATE telegram_bot_user SET user_id = ? WHERE telegram_bot_id = ? AND telegram_user_id = ?`,

    "unlinkUser": sql`UPDATE telegram_bot_user SET user_id = NULL WHERE telegram_bot_id = ? AND user_id = ?`,

    "createTelegramUser": sql`INSERT INTO telegram_user ( telegram_id, is_bot, username, first_name, last_name, language_code ) VALUES ( ?, ?, ?, ?, ?, ? ) ON CONFLICT ( telegram_id ) DO UPDATE SET username = EXCLUDED.username RETURNING id`.prepare(),

    "createTelegramBotUser": sql`INSERT INTO telegram_bot_user ( telegram_bot_id, telegram_user_id ) VALUES ( ?, ? ) ON CONFLICT ( telegram_bot_id, telegram_user_id ) DO NOTHING RETURNING id`.prepare(),
};

export default class TelegramBot {
    #app;
    #telegram;
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

    #locales = new Set();
    #languageLocales = {};

    #telegramBotApi;
    #started;

    #isShuttingDown = false;
    #getUpdates;
    #processUpdates;
    #users;
    #createUSerMutexes = new Mutex.Set();

    // XXX locales
    constructor ( telegram, id ) {
        this.#app = telegram.app;
        this.#telegram = telegram;
        this.#dbh = telegram.dbh;
        this.#id = id;

        // if ( this.config.locales ) {
        //     for ( let locale of this.config.locales ) {
        //         locale = new Locale( locale );

        //         if ( !this.#app.locales.isLocaleValid( locale.id ) ) continue;

        //         this.#locales.add( locale.id );

        //         this.#languageLocales[locale.language] ??= locale.id;
        //     }
        // }
    }

    // properties
    get app () {
        return this.#app;
    }

    get telegram () {
        return this.#telegram;
    }

    get component () {
        return this.#app[this.#type];
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

    get isStarted () {
        return this.#started;
    }

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    get defaultLocale () {
        return this.#app.locales.defaultLocale;
    }

    // public
    async init () {
        return this._init();
    }

    async start () {
        if ( this.#isShuttingDown ) return;

        this.#getUpdates.start();
        this.#processUpdates.start();
    }

    async stop () {
        return Promise.all( [

            //
            this.#getUpdates.stop(),
            this.#processUpdates.stop(),
        ] );
    }

    async shutDown () {
        this.#isShuttingDown = true;

        return this.stop();
    }

    async manualStart () {
        const res = await this.canStart();

        if ( !res.ok ) {
            const stop = await this.manualStop( res.statusText );

            if ( !stop.ok ) {
                return stop;
            }
            else {
                return res;
            }
        }
        else {
            const res = await this.dbh.do( SQL.updateStarted, [true, false, null] );

            if ( !res.ok ) return res;

            this.#started = true;

            this.start();

            return result( 200 );
        }
    }

    async manualStop ( error ) {
        const res = await this.dbh.do( SQL.updateStarted, [false, !!error, error] );

        if ( !res.ok ) return res;

        this.#started = false;

        this.stop();

        return result( 200 );
    }

    isLocaleValid ( locale ) {
        return this.#locales.has( locale );
    }

    defineLocale ( language ) {
        return this.#languageLocales[language] || this.defaultLocale;
    }

    async sendMessage ( chatId, text ) {
        return this.#telegramBotApi.sendMessage( chatId, text );
    }

    async send ( method, data ) {
        return this.#telegramBotApi.send( method, data );
    }

    async updateTelegramData () {
        return this.#updateTelegramData();
    }

    async setApiKey ( apiKey ) {
        return this.#updateTelegramData( apiKey );
    }

    // XXX locales
    updateTelegramBotFields ( fields ) {
        if ( fields.telegram_api_key ) this.#telegramBotApi.apiKey = fields.telegram_api_key;

        if ( fields.telegram_username != null ) this.#telegramUsername = fields.telegram_username;

        if ( fields.telegram_first_name != null ) this.#telegramFirstName = fields.telegram_first_name;

        if ( fields.telegram_can_join_groups != null ) this.#telegramCanJoinGroups = fields.telegram_can_join_groups;

        if ( fields.telegram_can_read_all_group_messages != null ) this.#telegramCanReadAllGroupMessages = fields.telegram_can_read_all_group_messages;

        if ( fields.telegram_supports_inline_queries != null ) this.#telegramSupportsInlineQueries = fields.telegram_supports_inline_queries;

        if ( fields.started != null && fields.started !== this.#started ) {
            if ( this.#started == null ) {
                this.#started = fields.started;
            }
            else {
                this.#started = fields.started;

                if ( this.#started ) {
                    this.start();
                }
                else {
                    this.stop();
                }
            }
        }
    }

    // XXX
    async isUserLinked ( userId ) {
        return false;
    }

    // XXX send notification
    // XXX send message to old telegram account
    async unlinkUser ( userId ) {
        const res = await this.dbh.do( SQL.unlinkUser, [this.id, userId] );

        if ( res.mets.rows ) {
            this.app.notifications.sendNotification( "security", res.data.userId, `Telegram linked`, `Your Telegram linked to your user profile.` );
        }

        return res;
    }

    // XXX
    async sendNotification ( users, subject, body ) {

        // const res = await this.#telegramBot.sendMessage( chatId, subject + "\n\n" + body );
        // if ( res.status === 403 ) {
        //     // XXX bot disabled
        // }
        // return res;
    }

    // protected
    async _init () {
        var res;

        res = await this.dbh.selectRow( SQL.init, [this.id] );
        if ( !res.ok ) return res;

        this.#type = res.data.type;
        this.#isStatic = res.data.static;
        this.#telegramId = res.data.telegram_id;

        this.#telegramBotApi = new TelegramBotApi( res.data.telegram_api_key );

        this.updateTelegramBotFields( res.data );

        this.#getUpdates = new TelegramBotGetUpdates( this, this.#telegramBotApi );
        this.#processUpdates = new TelegramBotProcessUpdates( this, this.#onTelegramUpdate.bind( this ) );

        this.#users = new TelegramBotUsers( this );

        return result( 200 );
    }

    async _canStart () {
        return result( 200 );
    }

    async _createUser ( dbh, telegramBotUserId ) {
        return result( 200 );
    }

    // private
    // XXX
    async #onTelegramUpdate ( update, signal ) {
        var user;

        user = await this.#users.getByTelegramId( update.data.from.id );

        if ( !user ) {
            await this.#createUser( update.data.from );

            user = await this.#users.getByTelegramId( update.data.from.id );
        }
        else {
            await user.setTelegramFields( update.data.from );
        }

        // aborted
        if ( signal.aborted ) return;

        update = new TelegramBotUpdate( this, signal, user, update );

        // link user command
        if ( update.type === "message" ) {
            if ( update.data.text.startsWith( "/start link-user-" ) ) {
                const token = update.data.text.substring( 17 );

                await this.#linkUser( update, token );
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
        if ( this.#telegramUsername !== res.data.username ) fields.add( "telegram_username", res.data.username );
        if ( this.#telegramFirstName !== res.data.first_name ) fields.add( "telegram_first_name", res.data.first_name );
        if ( this.#telegramCanJoinGroups !== res.data.can_join_groups ) fields.add( "telegram_can_join_groups", res.data.can_join_groups );
        if ( this.#telegramCanReadAllGroupMessages !== res.data.can_read_all_group_messages ) fields.add( "telegram_can_read_all_group_messages", res.data.can_read_all_group_messages );
        if ( this.#telegramSupportsInlineQueries !== res.data.supports_inline_queries ) fields.add( "telegram_supports_inline_queries", res.data.supports_inline_queries );

        // nothis to update
        if ( !fields.size ) return result( 200 );

        fields = Object.fromEntries( fields.entries() );

        res = await this.dbh.do( sql`UPDATE telegram_bot`.SET( fields ).sql`WHERE id = ${this.#id}` );
        if ( !res.ok ) return res;

        this.updateTelegramBotFields( fields );

        return result( 200 );
    }

    // XXX send notification
    async #linkUser ( update, token ) {
        const res = await this.dbh.begin( async dbh => {
            const res = await this.app.actionTokens.activateActionToken( token, constants.tokenTypeLinkTelegramAccount, { dbh } );

            if ( !res.ok ) throw result( [400, `Unable to link user. Token is not valid. Please, try agin.`] );

            const res1 = await dbh.do( SQL.linkUser, [res.data.userId, this.id, update.data.from.id] );

            if ( !res1.meta.rows ) throw result( [500, `Unable to link user. Internal server error. Please, try agin.`] );

            this.app.publishToApi( "/notifications/telegram-linked/", res.data.userId, true );

            this.sendMessage( update.chatId, `Congratulations. You account linked..` );

            this.app.notifications.sendNotification( "security", res.data.userId, `Telegram linked`, `Your Telegram linked to your user profile.` );
        } );

        if ( !res.ok ) {
            this.sendMessage( update.chatId, res.statusText );
        }
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
