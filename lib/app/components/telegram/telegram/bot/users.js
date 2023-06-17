import CacheLru from "#lib/cache/lru";

export default class TelegramBotUsers {
    #bot;
    #dbh;
    #cache;

    constructor ( bot ) {
        this.#bot = bot;
        this.#dbh = bot.dbh;

        this.#cache = new CacheLru();
    }

    // public
}
