import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";

const SQL = {
    "updateEnabled": sql`UPDATE telegram_bot SET enabled = ? WHERE id = ?`.prepare(),
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
    #isEnabled;
    #lastUpdateId;

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
    async start () {}

    stop () {}

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
}
