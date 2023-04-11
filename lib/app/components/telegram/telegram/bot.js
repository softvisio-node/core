import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import TelegramBotUpdate from "./bot/update.js";

const DEFAULT_GET_UPDATES_TIMEOUT = 60; // seconds, 1 minute

const SQL = {
    "updateError": sql`UPDATE telegram_bot SET error = ?, error_text = ? WHERE id = ?`.prepare(),

    "updateEnabled": sql`UPDATE telegram_bot SET enabled = ? WHERE id = ?`.prepare(),

    "getTelegramNextUpdateId": sql`SELECT telegram_next_update_id FROM telegram_bot WHERE id = ?`.prepare(),

    "setTelegramNextUpdateId": sql`UPDATE telegram_bot SET telegram_next_update_id = ? WHERE id = ?`.prepare(),
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
    #isStarted = false;
    #isEnabled;
    #telegramNextUpdateId;
    #error;
    #getUpdatesAbortController;

    constructor ( telegram, { id, type, apiKey, telegramId, telegramUsername } ) {
        this.#app = telegram.app;
        this.#telegram = telegram;
        this.#dbh = telegram.dbh;
        this.#type = type;
        this.#id = id;
        this.#telegramId = telegramId;
        this.#telegramUsername = telegramUsername;

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

    get telegramFirstName () {
        return this.#telegramFirstName;
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

    async start () {
        if ( this.isStarted || !this.#isEnabled ) return;

        this.#isStarted = true;

        // drop bot error status
        await this.#setError( result( 200 ) );

        this.#getUpdatesAbortController = new AbortController();

        var res;

        res = await this.#beforeStart();

        if ( res.ok ) res = await this.#start();

        if ( !res.ok ) await this.#setError( res );

        this.#getUpdatesAbortController = null;

        this.#isStarted = false;
    }

    stop () {
        if ( !this.#isStarted ) return;

        this.#getUpdatesAbortController?.abort();
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
    async #beforeStart () {
        var res;

        res = await this.#updateTelegramData();
        if ( !res.ok ) return res;

        res = await this.#dbh.selectRow( SQL.getTelegramNextUpdateId, [this.#id] );
        if ( !res.ok ) return res;

        this.#telegramNextUpdateId = res.data.telegram_next_update_id;

        return res;
    }

    async #start () {
        const signal = this.#getUpdatesAbortController.signal;

        while ( true ) {

            // bot was disabled
            if ( !this.#isEnabled ) return result( 200 );

            const updates = await this.#telegramBotApi.getUpdates( {
                "offset": this.#telegramNextUpdateId,
                "timeout": DEFAULT_GET_UPDATES_TIMEOUT,
                "allowedUpdates": null,
                signal,
            } );

            // get updates error
            if ( !updates.ok ) {

                // request was aborted
                if ( signal.aborted ) return result( 200 );

                return updates;
            }

            // no updates received
            if ( !updates.data?.length ) continue;

            // process updates
            for ( let update of updates.data ) {

                // bot was disabled
                if ( !this.#isEnabled ) return result( 200 );

                update = new TelegramBotUpdate( this, update );

                const res = await this.#onTelegramUpdate( update );

                // error processing update
                if ( !res.ok ) return res;

                await this.#setTelegramNextUpdateId( update.id + 1 );
            }
        }
    }

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

            await this.setEnabled( false );
        }
    }

    // XXX
    async #onTelegramUpdate ( update ) {
        return result( 200 );
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
