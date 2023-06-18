import TelegramUser from "../user.js";
import sql from "#lib/sql";

const SQL = {
    "setBlocked": sql`UPDATE telegram_bot_user SET blocked = ? WHERE id = ?`.prepare(),
};

export default class TelegramBotUser extends TelegramUser {
    #bot;
    #telegramBotUserId;
    #apiUserId;
    #blocked;
    #banned;
    #state;

    constructor ( bot, fields ) {
        super( bot.dbh, fields );

        this.#bot = bot;
        this.#telegramBotUserId = fields.telegram_bot_user_id;

        this.updateTelegramBotUserFields( fields );
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get telegramBotUserId () {
        return this.#telegramBotUserId;
    }

    get apiUserId () {
        return this.#apiUserId;
    }

    get isBlocked () {
        return this.#blocked;
    }

    get isBanned () {
        return this.#banned;
    }

    get state () {
        return this.#state;
    }

    // public
    updateTelegramBotUserFields ( fields ) {
        if ( "api_user_id" in fields != null ) this.#apiUserId = fields.api_user_id;

        if ( "blocked" in fields != null ) this.#blocked = fields.blocked;

        if ( "banned" in fields != null ) this.#banned = fields.banned;

        if ( "state" in fields != null ) this.#state = fields.state;
    }

    // XXX
    async setApiUserId ( apiUserId ) {}

    // XXX
    async setBlocked ( value ) {
        if ( value === this.#blocked ) return result( 200 );

        const res = await this.dbh.do( SQL.setBlocked, [] );

        if ( !res.ok ) return res;

        this.#blocked = value;

        return result( 200 );
    }

    // XXX
    async setBanned ( value ) {
        if ( value === this.#banned ) return result( 200 );

        const res = await this.dbh.do( SQL.setBanned, [] );

        if ( !res.ok ) return res;

        this.#banned = value;

        return result( 200 );
    }

    // XXX
    async setState ( state ) {}
}
