import TelegramUser from "../user.js";
import sql from "#lib/sql";

const SQL = {
    "setBlocked": sql`UPDATE telegram_bot_user SET blocked = ? WHERE id = ?`.prepare(),
};

export default class TelegramBotUser extends TelegramUser {
    #bot;
    #dbh;
    #botUserId;
    #apiUserId;
    #blocked;
    #banned;
    #state;

    constructor ( bot, fields ) {
        super( bot.dbh, fields );

        this.#bot = bot;
        this.#dbh = bot.dbh;

        this.#botUserId = fields.telegram_bot_user_id;

        this.updateBotUserFields( fields );
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get botUserId () {
        return this.#botUserId;
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
    updateBotUserFields ( fields ) {
        if ( "api_user_id" in fields != null ) this.#apiUserId = fields.api_user_id;

        if ( "blocked" in fields != null ) this.#blocked = fields.blocked;

        if ( "banned" in fields != null ) this.#banned = fields.banned;

        if ( "state" in fields != null ) this.#state = fields.state;
    }

    // XXX
    async setApiUserId ( apiUserId ) {
        if ( this.#apiUserId === apiUserId ) return result( 200 );

        var res = await this.#dbh.do( SQL.setApiUserId, [apiUserId, this.#botUserId] );
        if ( !res.pk ) return res;
    }

    async setBlocked ( value ) {
        if ( value === this.#blocked ) return result( 200 );

        const res = await this.#dbh.do( SQL.setBlocked, [value, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#blocked = value;

        return result( 200 );
    }

    // XXX
    async setState ( state ) {}
}
