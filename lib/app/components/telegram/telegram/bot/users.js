import CacheLru from "#lib/cache/lru";
import sql from "#lib/sql";
import User from "./user.js";

const SQL = {
    "getByTelegramUserId": sql``.prepare(),
};

export default class TelegramBotUsers {
    #bot;
    #dbh;
    #getUser;

    #cache;
    #telegramUserIdIndex = {};
    #telegramBotUserIdIndex = {};
    #apiUserId = {};

    constructor ( bot, getUser ) {
        this.#bot = bot;
        this.#dbh = bot.dbh;

        this.#cache = new CacheLru();
        this.#getUser = getUser;

        this.#dbh.on( "disconnect", () => this.#clear.bind( this ) );
    }

    // public
    async getByTelegramUserId ( telegramUserId ) {
        var user = this.#cache.get( telegramUserId );

        if ( !user ) {
            const res = await this.#dbh.selectRow( SQL.getByTelegramUserId, [telegramUserId] );

            if ( !res.ok ) return;

            user = new User( res.data );

            this.#cacheUser( user );
        }

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
    #cacheUser ( user ) {
        if ( !user ) return;
    }

    #clear () {
        this.#cache.clear( true );
    }
}
