import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import TelegramBotUpdate from "./bot/update.js";
import Signal from "#lib/threads/signal";
import constants from "#lib/app/constants";
import Mutex from "#lib/threads/mutex";

const DEFAULT_GET_UPDATES_TIMEOUT = 60; // seconds, 1 minute

const SQL = {
    "init": sql`SELECT * FROM telegram_bot WHERE id = ?`.prepare(),

    "updateError": sql`UPDATE telegram_bot SET error = ?, error_text = ? WHERE id = ?`.prepare(),

    "updateStarted": sql`UPDATE telegram_bot SET started = ? WHERE id = ?`.prepare(),

    "getTelegramNextUpdateId": sql`SELECT telegram_next_update_id FROM telegram_bot WHERE id = ?`.prepare(),

    "setTelegramNextUpdateId": sql`UPDATE telegram_bot SET telegram_next_update_id = ? WHERE id = ?`.prepare(),

    "linkUser": sql`UPDATE telegram_bot_user SET user_id = ? WHERE telegram_bot_id = ? AND telegram_user_id = ?`,

    "unlinkUser": sql`UPDATE telegram_bot_user SET user_id = NULL WHERE telegram_bot_id = ? AND user_id = ?`,
};

export default class TelegramBot {
    #app;
    #telegram;
    #dbh;
    #type;
    #id;
    #telegramId;
    #telegramUsername;
    #telegramFirstName;
    #telegramCanJoinGroups;
    #telegramCanReadAllGroupMessages;
    #telegramSupportsInlineQueries;

    #telegramBotApi;
    #telegramNextUpdateId;
    #isStatic;
    #isStarted;
    #error;

    #updatesStarted = false;
    #updatesAbortController;
    #stopSignal = new Signal();

    // XXX ==============================

    #isListening = false;
    #getUpdatesAbortController;
    #startMutex;
    #isStopping = false;

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

    get isStopping () {
        return this.#isStopping;
    }

    get telegramId () {
        return this.#telegramId;
    }

    get telegramUsername () {
        return this.#telegramUsername;
    }

    get isListening () {
        return this.#isListening;
    }

    get isStarted () {
        return this.#isStarted;
    }

    // public
    async init () {
        return this._init();
    }

    // XXX
    update ( data ) {
        if ( "telegram_api_key" in data ) this.#telegramBotApi.apiKey = data.telegram_api_key;
        if ( "telegram_username" in data ) this.#telegramUsername = data.telegram_username;
        if ( "telegram_first_name" in data ) this.#telegramFirstName = data.telegram_first_name;

        this.#telegramCanJoinGroups = data.telegram_can_join_groups;

        this.#telegramCanReadAllGroupMessages = data.telegram_can_read_all_group_messages;

        this.#telegramSupportsInlineQueries = data.telegram_supports_inline_queries;

        this.#error = data.error;

        // started
        if ( "started" in data && data.started !== this.#isStarted ) {
            this.#isStarted = data.started;

            // if ( this.#isStarted ) {
            //     this.start();
            // }
            // else {
            //     this.stop();
            // }
        }
    }

    // XXX mutex disconnect - repeat
    // XXX shuttingDown - break, broadcast shutdown signal
    // XXX stopped - break
    async start () {
        if ( this.#updatesStarted ) return;

        // start
        this.#updatesStarted = true;
        this.#updatesAbortController = new AbortController();

        START: while ( true ) {

            // unlock mutex in case or repeat
            await this.#startMutex.unlock();

            // can't start bot
            if ( !( await this._canStart() ) ) break;

            // lock mutex
            await this.#startMutex.lock();
            const signal = this.#startMutex.signal;

            let res = await this.#updateTelegramData();
            if ( !res.ok ) break;

            res = await this.#dbh.selectRow( SQL.getTelegramNextUpdateId, [this.#id] );
            if ( !res.ok ) break;

            this.#telegramNextUpdateId = res.data.telegram_next_update_id;

            // mutex was disconnected, restart
            if ( signal.aborted ) continue START;

            // XXX checkstart conditions
            // if (!this.#started) break STOP;

            // drop bot error status
            await this.#setError( result( 200 ) );

            // XXX start updates cycle
            UPDATES: while ( true ) {
                const updates = await this.#telegramBotApi.getUpdates( {
                    "offset": this.#telegramNextUpdateId,
                    "timeout": DEFAULT_GET_UPDATES_TIMEOUT,
                    "allowedUpdates": null,
                    signal,
                } );

                // get updates error
                if ( !updates.ok ) {

                    // mutex was disconnected, restart
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

    // XXX check start conditions
    // XXX update database;
    // XXX return result
    async setStarted ( started ) {
        if ( started === this.#isStarted ) return result( 200 );

        const res = await this.dbh.do( SQL.updateStarted, [started, this.id] );
        if ( !res.ok ) return res;

        this.#isStarted = started;

        // bot started
        if ( started ) {

            // XXX
            this.start();
        }

        // bot disabled
        else {
            this.stop();
        }

        return result( 200 );
    }

    // XXX
    async linkUser ( token, userId, telegramUserId ) {

        // verify token
        var res = await this.app.api.userActionToken.activateUserActionToken( token, constants.tokenTypeLinkTelegramAccount, { userId } );

        if ( !res.ok ) return res;

        res = await this.dbh.do( SQL.linkUser, [userId, this.id, telegramUserId] );

        if ( !res.ok ) return res;

        return res;
    }

    // XXX
    async unlinkUser ( userId ) {
        const res = await this.dbh.do( SQL.unlinkUser, [this.id, userId] );

        return res;
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

        this.update( res.data );

        return result( 200 );
    }

    async _canStart () {
        return result( 200 );
    }

    // private

    async #setTelegramNextUpdateId ( nextUpdateId ) {
        this.#telegramNextUpdateId = nextUpdateId;

        return this.dbh.do( SQL.setTelegramNextUpdateId, [nextUpdateId, this.id] );
    }

    async #setError ( res ) {

        // error status not changed
        if ( this.#error === res.ok ) return;

        if ( res.ok ) {
            await this.dbh.do( SQL.updateError, [false, null, this.id] );
        }
        else {
            await this.dbh.do( SQL.updateError, [true, res.statusText, this.id] );

            await this.setStarted( false );
        }
    }

    // XXX
    async #onTelegramUpdate ( update ) {
        await this._update( update );
    }

    async #updateTelegramData ( apiKey ) {

        // api key not changed
        if ( apiKey && apiKey === this.#telegramBotApi.apiKey ) return result( 200 );

        const api = apiKey ? new TelegramBotApi( apiKey ) : this.#telegramBotApi;

        var res = await api.send( "getMe" );
        if ( !res.ok ) return res;

        if ( res.data.id + "" !== this.#telegramId ) return result( [400, `Api key is not valid`] );

        var fields = new Map();

        if ( apiKey ) fields.set( "telegram_api_key", apiKey );
        if ( this.#telegramUsername !== res.data.username ) fields.add( "telegram_username", res.data.username );
        if ( this.#telegramFirstName !== res.data.first_name ) fields.add( "telegram_first_name", res.data.first_name );
        if ( this.#telegramCanJoinGroups !== res.data.can_join_groups ) fields.add( "telegram_can_join_groups", res.data.can_join_groups );
        if ( this.#telegramCanReadAllGroupMessages !== res.data.can_read_all_group_messages ) fields.add( "telegram_can_read_all_group_messages", res.data.can_read_all_group_messages );
        if ( this.#telegramSupportsInlineQueries !== res.data.supports_inline_queries ) fields.add( "telegram_supports_inline_queries", res.data.supports_inline_queries );

        // nothis to update
        if ( !fields.soze ) return result( 200 );

        fields = Object.fromEntries( fields.entries() );

        res = await this.dbh.do( sql`UPDATE telegram_bot`.SET( fields ).sql`WHERE id = ${this.#id}` );
        if ( !res.ok ) return res;

        if ( "telegram_api_key" in fields ) this.#telegramBotApi.apiKey = apiKey;
        if ( "telegram_username" in fields ) this.#telegramUsername = fields.telegram_username;
        if ( "telegram_first_name" in fields ) this.#telegramFirstName = fields.telegram_first_name;
        if ( "telegram_can_join_groups" in fields ) this.#telegramCanJoinGroups = fields.telegram_can_join_groups;
        if ( "telegram_can_read_all_group_messages" in fields ) this.#telegramCanReadAllGroupMessages = fields.telegram_can_read_all_group_messages;
        if ( "telegram_supports_inline_queries" in fields ) this.#telegramSupportsInlineQueries = fields.telegram_supports_inline_queries;

        return result( 200 );
    }
}
