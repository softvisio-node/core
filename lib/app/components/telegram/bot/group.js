export default class {
    #bot;
    #id;

    constructor ( bot, id ) {
        this.#bot = bot;
        this.#id = id;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    // XXX
    get url () {
        return `https://t.me/c/${ this.#id }/6`;
    }

    // public
    async send ( method, data ) {
        data = data ? { ...data } : {};

        data.chat_id = this.#id;

        return this.#bot.telegramBotApi.send( method, data );
    }

    async hideGeneralForumTopic () {
        var res;

        res = await this.send( "hideGeneralForumTopic" );

        if ( !res.ok ) return res;

        return res;
    }

    async createChatInviteLink ( data ) {
        return this.send( "createChatInviteLink", data );
    }
}
