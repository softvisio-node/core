import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import Events from "#lib/events";
import TelegramBotUpdate from "./bot/update.js";
import Signal from "#lib/threads/signal";
import constants from "#lib/app/constants";
import Mutex from "#lib/threads/mutex";
import Counter from "#lib/threads/counter";
import AbortSignals from "#lib/abort-signals";

const DEFAULT_GET_UPDATES_TIMEOUT = 60; // seconds, 1 minute

const SQL = {
    "init": sql`SELECT * FROM telegram_bot WHERE id = ?`.prepare(),

    "updateStarted": sql`UPDATE telegram_bot SET started = ?, error = ?, error_text = ? WHERE id = ?`.prepare(),

    "getTelegramNextUpdateId": sql`SELECT telegram_next_update_id FROM telegram_bot WHERE id = ?`.prepare(),

    "unlockUpdates": sql`UPDATE telegram_bot_update SET locked = FALSE WHERE telegram_bot_id = ?`,

    "getUpdates": sql`
WITH cte AS (
    SELECT id FROM telegram_bot_update WHERE telegram_bot_id = ? ORDER BY update_id LIMIT ?
)
UPDATE telegram_bot_update USING cte WHERE id = cte.id RETURNING id, type, data

`.prepare(),

    "deleteUpdate": sql`DELETE FROM telegram_bot_update WHERE id = ?`.prepare,

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
    #updaterStarted = false;
    #processorStarted = false;
    #stopController;
    #upderMutex;
    #processorMutex;
    #chatMutexes = new Mutex.Set();
    #activityCounter = new Counter();

    constructor ( telegram, id ) {
        this.#app = telegram.app;
        this.#telegram = telegram;
        this.#dbh = telegram.dbh;
        this.#id = id;

        this.#upderMutex = this.app.cluster ? this.app.cluster.mutexes.get( "telegram/bot/updater/" + this.#id ) : new Mutex();

        this.#processorMutex = this.app.cluster ? this.app.cluster.mutexes.get( "telegram/bot/processor/" + this.#id ) : new Mutex();
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

        this.#stopController = new AbortController();

        this.#startUpdater();

        this.#startProcessor();
    }

    async stop () {
        if ( !this.#updaterStarted ) return;

        this.#stopController.abort();

        return this.#activityCounter.wait();
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
    async #startUpdater () {
        if ( this.#updaterStarted ) return;
        this.#updaterStarted = true;

        const stopSignal = this.#stopController.signal;

        this.#activityCounter.inc();

        START: while ( true ) {

            // aborted
            if ( stopSignal.aborted ) break START;

            // unlock mutex in case or repeat
            await this.#upderMutex.unlock();

            // lock mutex
            await this.#upderMutex.lock( { "signal": stopSignal } );

            // aborted
            if ( stopSignal.aborted ) break START;

            const abortController = new AbortController(),
                signal = abortController.signal;

            const mutexSignal = this.#upderMutex.unlockSignal;

            stopSignal.addEventListener( "abort", () => abortController.abort() );
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

                let telegramNextUpdateId = this.#telegramNextUpdateId;

                const res = await this.dbh.do( sql`INSERT INTO telegram_bot_update`.VALUES( updates.data.map( update => {
                    const updateId = update.update_id;
                    delete update.update_id;

                    telegramNextUpdateId = updateId + 1;

                    const type = Object.keys( update )[0];

                    return {
                        "telegram_bot_id": this.id,
                        "update_id": updateId,
                        type,
                        "data": update[type],
                    };
                } ) ) );

                if ( res.ok ) {
                    this.#telegramNextUpdateId = telegramNextUpdateId;
                }
            }
        }

        // unlock mutex
        await this.#upderMutex.unlock();

        // stop
        this.#updaterStarted = false;
        this.#stopController = null;

        this.#activityCounter.dec();
    }

    // XXX
    async #startProcessor () {
        if ( this.#processorStarted ) return;
        this.#processorStarted = true;

        const events = new Events().link( this.dbh ),
            hasUpdates = new Signal();

        this.#activityCounter.inc();

        START: while ( true ) {
            const signal = new AbortSignals().addSignals( this.#stopController.signal );

            // aborted
            if ( signal.aborted ) break START;

            // unlock mutex in case or repeat
            await this.#processorMutex.unlock();

            // lock mutex
            await this.#processorMutex.lock( { "signal": signal } );

            // aborted
            if ( signal.aborted ) break START;

            signal.addSignals( this.#processorMutex.unlockSignal );

            // aborted
            if ( signal.aborted ) continue START;

            // unlock updates
            const res = await this.dbh.do( SQL.unlockUpdates, [this.id] );
            if ( !res.ok ) continue START;

            // aborted
            if ( signal.aborted ) continue START;

            // listen for updates on database
            events.on( "telegram/telegram-bot-update/create", data => {
                if ( data.telegram_bot_id === this.id ) hasUpdates.broadcast();
            } );

            // start updates cycle
            while ( true ) {

                // aborted
                if ( signal.aborted ) continue START;

                const updates = await this.dbh.selectAll( SQL.getUpdates, [this.id, 100] );
                if ( !updates.ok ) continue START;

                // XXX
                if ( !updates.data ) await hasUpdates.wait();

                for ( let update of updates.data ) {
                    const user = null;

                    update = new TelegramBotUpdate( this, user, update );
                }
            }
        }

        events.clear();

        // unlock mutex
        await this.#processorMutex.unlock();

        // stop
        this.#processorStarted = false;
        this.#stopController = null;

        this.#activityCounter.dec();
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
