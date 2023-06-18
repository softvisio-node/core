import TelegramUser from "../user.js";
import sql from "#lib/sql";

const SQL = {
    "setApiUserId": sql`UPDATE telegram_bot_user SET api_user_id = ? WHERE id = ?`.prepare(),

    "deleteApiUserId": sql`UPDATE telegram_bot_user SET api_user_id = NULL WHERE api_user_id = ?`.prepare(),

    "setState": sql`UPDATE telegram_bot_user SET state = ? WHERE id = ?`.prepare(),
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

    async setApiUserId ( apiUserId ) {
        apiUserId ||= null;

        if ( this.#apiUserId === apiUserId ) return result( 200 );

        var res;

        if ( !apiUserId ) {
            res = await this.#dbh.do( SQL.setApiUserId, [null, this.#botUserId] );
        }
        else {
            res = await this.#dbh.begin( async dbh => {
                var res = await dbh.do( SQL.deleteApiUserId, [apiUserId] );
                if ( !res.ok ) throw res;

                res = await dbh.do( SQL.setApiUserId, [apiUserId, this.#botUserId] );
                if ( !res.ok ) throw res;

                return res;
            } );
        }

        if ( res.ok ) this.#apiUserId = apiUserId;

        return res;
    }

    async setBlocked ( value ) {
        if ( value === this.#blocked ) return result( 200 );

        const res = await this.#dbh.do( SQL.setBlocked, [value, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#blocked = value;

        return result( 200 );
    }

    async setState ( state ) {
        const res = await this.#dbh.do( SQL.setState, [state, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#state = state;

        return result( 200 );
    }
}
