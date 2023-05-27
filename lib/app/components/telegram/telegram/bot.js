import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import TelegramBotUpdate from "./bot/update.js";
import Signal from "#lib/threads/signal";
import constants from "#lib/app/constants";
import Mutex from "#lib/threads/mutex";

const DEFAULT_GET_UPDATES_TIMEOUT = 60; // seconds, 1 minute

const SQL = {
    "init": sql`SELECT * FROM telegram_bot WHERE id = ?`.prepare(),

    "updateStarted": sql`UPDATE telegram_bot SET started = ?, error = ?, error_text = ? WHERE id = ?`.prepare(),

    "getTelegramNextUpdateId": sql`SELECT telegram_next_update_id FROM telegram_bot WHERE id = ?`.prepare(),

    "setTelegramNextUpdateId": sql`UPDATE telegram_bot SET telegram_next_update_id = ? WHERE id = ?`.prepare(),

    "linkUser": sql`UPDATE telegram_bot_user SET user_id = ? WHERE telegram_bot_id = ? AND telegram_user_id = ?`,

    "unlinkUser": sql`UPDATE telegram_bot_user SET user_id = NULL WHERE telegram_bot_id = ? AND user_id = ?`,
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

    #telegramBotApi;
    #telegramNextUpdateId;
    #started;

    #isShuttingDown = false;
    #updatesStarted = false;
    #updatesAbortController;
    #startMutex;
    #stopSignal = new Signal();

    constructor ( telegram, id ) {
        this.#app = telegram.app;
        this.#telegram = telegram;
        this.#dbh = telegram.dbh;
        this.#id = id;

        this.#startMutex = this.app.cluster ? this.app.cluster.mutexes.get( "telegram/bot/start/" + this.#id ) : new Mutex();
    }

    // properties
    get app () {
        return this.#app;
    }

    get telegram () {
        return this.#telegram;
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

    // public
    async init () {
        return this._init();
    }

    async start () {
        if ( this.#isShuttingDown ) return;

        if ( !this.#started ) return;

        if ( this.#updatesStarted ) return;

        // start
        this.#updatesStarted = true;

        this.#updatesAbortController = new AbortController();
        const updatesAbortSignal = this.#updatesAbortController.signal;

        START: while ( true ) {

            // aborted
            if ( updatesAbortSignal.aborted ) break START;

            // unlock mutex in case or repeat
            await this.#startMutex.unlock();

            // lock mutex
            await this.#startMutex.lock( { "signal": updatesAbortSignal } );

            // aborted
            if ( updatesAbortSignal.aborted ) break START;

            const abortController = new AbortController(),
                signal = abortController.signal;

            const mutexSignal = this.#startMutex.unlockSignal;

            updatesAbortSignal.addEventListener( "abort", () => abortController.abort() );
            mutexSignal.addEventListener( "abort", () => abortController.abort() );

            let res = await this.#updateTelegramData();
            if ( !res.ok ) {

                // api key is invalid
                if ( res.status === 401 ) {
                    this.manualStop( "API key is not valid" );
                    break START;
                }

                // some other error, restart
                else {
                    continue START;
                }
            }

            res = await this.#dbh.selectRow( SQL.getTelegramNextUpdateId, [this.#id] );
            if ( !res.ok ) continue START;

            this.#telegramNextUpdateId = res.data.telegram_next_update_id;

            // aborted
            if ( signal.aborted ) continue START;

            // start updates cycle
            UPDATES: while ( true ) {

                // aborted
                if ( signal.aborted ) continue START;

                const updates = await this.#telegramBotApi.getUpdates( {
                    "offset": this.#telegramNextUpdateId,
                    "timeout": DEFAULT_GET_UPDATES_TIMEOUT,
                    "allowedUpdates": null,
                    signal,
                } );

                // get updates error
                if ( !updates.ok ) {

                    // aborted
                    if ( signal.aborted ) continue START;

                    // XXX check status, break on fatal errors (API key invalid)
                    continue UPDATES;
                }

                // no updates received
                if ( !updates.data?.length ) continue UPDATES;

                // process updates
                for ( let update of updates.data ) {
                    update = new TelegramBotUpdate( this, update );

                    await this.#onTelegramUpdate( update );

                    await this.#setTelegramNextUpdateId( update.id + 1 );

                    // aborted
                    if ( signal.aborted ) continue START;
                }
            }
        }

        // unlock nutex
        await this.#startMutex.unlock();

        // stop
        this.#updatesStarted = false;
        this.#updatesAbortController = null;

        this.#stopSignal.broadcast();
    }

    async stop () {
        if ( !this.#updatesStarted ) return;

        this.#updatesAbortController.abort();

        return this.#stopSignal.wait();
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
        //     // XXX bot banned
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

        return result( 200 );
    }

    async _canStart () {
        return result( 200 );
    }

    async _createUser ( dbh, id ) {
        return result( 200 );
    }

    // private
    async #setTelegramNextUpdateId ( nextUpdateId ) {
        const res = await this.dbh.do( SQL.setTelegramNextUpdateId, [nextUpdateId, this.id] );

        if ( res.ok ) {
            this.#telegramNextUpdateId = nextUpdateId;
        }

        return res;
    }

    // XXX
    async #onTelegramUpdate ( update ) {

        // var user = await this.#getUser( update.data.from.id );

        // if ( !user ) user = await this.#createUser( update.data.from );

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
            const res = await this.app.api.actionTokens.activateActionToken( token, constants.tokenTypeLinkTelegramAccount, { dbh } );

            if ( !res.ok ) throw result( [400, `Unable to link user. Token is not valid. Please, try agin.`] );

            const res1 = await dbh.do( SQL.linkUser, [res.data.userId, this.id, update.data.from.id] );

            if ( !res1.meta.rows ) throw result( [500, `Unable to link user. Internal server error. Please, try agin.`] );

            this.app.publish( "/api/notifications/telegram-linked/", res.data.userId, true );

            this.sendMessage( update.chatId, `Congratulations. You account linked..` );

            this.app.notifications.sendNotification( "security", res.data.userId, `Telegram linked`, `Your Telegram linked to your user profile.` );
        } );

        if ( !res.ok ) {
            this.sendMessage( update.chatId, res.statusText );
        }
    }

    // XXX
    async #getUser ( telegramUserId ) {}

    // XXX
    //  id: 1460604066,
    // is_bot: false,
    // first_name: 'zdm',
    // last_name: 'last
    // username: 'zdm002',
    // language_c
    async #createUser ( options ) {}
}
