import TelegramBotApi from "#lib/api/telegram/bot";

export default class TelegramBot {
    #app;
    #telegram;
    #dbh;
    #type;
    #id;
    #telegramId;
    #telegramUsername;
    #telegramBotApi;

    constructor ( telegram, id, apiKey ) {
        this.#app = telegram.app;
        this.#telegram = telegram;
        this.#dbh = telegram.dbh;
        this.#id = id;

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

    // public
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
}
