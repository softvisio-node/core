import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import TelegramBotUpdate from "./bot/update.js";

const DEFAULT_GET_UPDATES_TIMEOUT = 60; // seconds, 1 minute

const SQL = {
    "updateError": sql`UPDATE telegram_bot SET error = ?, error_text = ? WHERE id = ?`.prepare(),

    "updateEnabled": sql`UPDATE telegram_bot SET enabled = ? WHERE id = ?`.prepare(),

    "updateTelegramNextUpdateId": sql`UPDATE telegram_bot SET telegram_next_update_id = ? WHERE id = ?`.prepare(),
};

export default class TelegramBot {
    #app;
    #telegram;
    #dbh;
    #type;
    #id;
    #telegramId;
    #telegramUsername;
    #telegramName;
    #telegramBotApi;
    #isStarted = false;
    #isEnabled;
    #telegramNextUpdateId;
    #error;
    #getUpdatesAbortController;

    constructor ( telegram, { id, type, apiKey, telegramId, telegramUsername, telegramName } ) {
        this.#app = telegram.app;
        this.#telegram = telegram;
        this.#dbh = telegram.dbh;
        this.#type = type;
        this.#id = id;
        this.#telegramId = telegramId;
        this.#telegramUsername = telegramUsername;
        this.#telegramName = telegramName;

        this.#telegramBotApi = new TelegramBotApi( apiKey );
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

    get telegramId () {
        return this.#telegramId;
    }

    get telegramUsername () {
        return this.#telegramUsername;
    }

    get telegramName () {
        return this.#telegramName;
    }

    get isStarted () {
        return this.#isStarted;
    }

    get isEnabled () {
        return this.#isEnabled;
    }

    // public
    // XXX
    update ( data ) {}

    // XXX
    // update bot data
    // get last_update_id
    // set dbh listeners
    // get updates
    async start () {
        if ( this.isStarted || !this.#isEnabled ) return;

        this.#isStarted = true;

        this.#getUpdatesAbortController = new AbortController();

        const signal = this.#getUpdatesAbortController.signal;

        while ( true ) {

            // bot was disabled
            if ( !this.#isEnabled ) break;

            const updates = await this.#telegramBotApi.getUpdates( {
                "offset": this.#telegramNextUpdateId,
                "timeout": DEFAULT_GET_UPDATES_TIMEOUT,
                "allowedUpdates": null,
                signal,
            } );

            // get updates error
            if ( !updates.ok ) {

                // request was aborted
                if ( signal.aborted ) {
                    this.#getUpdatesAbortController = null;

                    break;
                }

                await this.#setError( updates );

                break;
            }

            // no updates received
            if ( !updates.data?.length ) continue;

            for ( let update of updates.data ) {
                update = new TelegramBotUpdate( this, update );

                const res = await this.#onTelegramUpdate( update );

                // error processing update
                if ( !res.ok ) {
                    await this.#setError( res );

                    break;
                }
                else {
                    await this.#setTelegramNextUpdateId( update.id + 1 );
                }

                // bot was disabled
                if ( !this.#isEnabled ) break;
            }

            // bot was disabled
            if ( !this.#isEnabled ) break;
        }

        this.#isStarted = false;
    }

    stop () {
        if ( !this.#isStarted ) return;

        this.#getUpdatesAbortController.abort();
    }

    async sendMessage ( chatId, text ) {
        return this.#telegramBotApi.sendMessage( chatId, text );
    }

    async send ( method, data ) {
        return this.#telegramBotApi.send( method, data );
    }

    // XXX update username in the database
    async updateBotInfo () {
        const res = await this.#telegramBotApi.send( "getMe" );

        if ( res.data?.username ) {
            this.#telegramUsername = res.data?.username;
        }

        return res;
    }

    // XXX
    async setEnabled ( enabled ) {
        if ( enabled === this.#isEnabled ) return result( 200 );

        const res = await this.dbh.do( SQL.updateEnabled, [enabled, this.id] );
        if ( !res.ok ) return res;

        this.#isEnabled = enabled;

        // bot enabled
        if ( enabled ) {

            // XXX start
        }

        // bot disabled
        else {

            // XXX cleat user cache
            // XXX stop
        }

        return result( 200 );
    }

    // protected

    // private
    async #setTelegramNextUpdateId ( nextUpdateId ) {
        this.#telegramNextUpdateId = nextUpdateId;

        return this.dbh.do( SQL.updateTelegramNextUpdateId, [nextUpdateId, this.id] );
    }

    async #setError ( res ) {

        // error status not changed
        if ( this.#error === res.ok ) return;

        if ( res.ok ) {
            await this.dbh.do( SQL.updateError, [false, null, this.id] );
        }
        else {
            await this.dbh.do( SQL.updateError, [true, res.statusText, this.id] );

            await this.setEnabled( false );
        }
    }

    async #onTelegramUpdate ( update ) {
        return result( 200 );
    }
}
