import CacheLru from "#lib/cache/lru";

export default class TelegramBotUsers {
    #bot;
    #dbh;
    #getUser;

    #cache;
    #telegramBotUserIdIndex = {};

    constructor ( bot, getUser ) {
        this.#bot = bot;
        this.#dbh = bot.dbh;

        this.#cache = new CacheLru();
        this.#getUser = getUser;

        this.#dbh.on( "disconnect", () => this.#clear.bind( this ) );
    }

    // public
    getCachedUserByTelegramUserId ( telegramUserId ) {
        const user = this.#cache.get( telegramUserId );

        return user;
    }

    async getUser ( telegramUserId ) {
        var user = this.getCachedUserByTelegramUserId( telegramUserId );

        if ( !user ) {
            user = await this.#getUser( telegramUserId );
        }

        return user;
    }

    // private
    #clear () {
        this.#cache.clear( true );
    }
}
