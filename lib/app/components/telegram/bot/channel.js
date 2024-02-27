import TelegramChannel from "../channel.js";

// import sql from "#lib/sql";

// const SQL = {
//     "setSubscribed": sql`UPDATE telegram_bot_user SET subscribed = ? WHERE id = ?`.prepare(),

//     "setBanned": sql`UPDATE telegram_bot_user SET banned = ? WHERE id = ?`.prepare(),

//     "setState": sql`UPDATE telegram_bot_user SET state = ? WHERE id = ?`.prepare(),

//     "setLocale": sql`UPDATE telegram_bot_user SET locale = ? WHERE id = ?`.prepare(),
// };

export default class TelegramBotChannel extends TelegramChannel {
    #bot;
    #id;
    #status;

    // XXX --------------------------------------

    constructor ( bot, data ) {
        super( bot.telegram, data );

        this.#bot = bot;

        const fields = data.telegram_bot_user;

        this.#id = fields.id;

        this.updateTelegramBotUserFields( fields );
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get app () {
        return this.#bot.app;
    }

    get id () {
        return this.#id;
    }

    get telegramId () {
        return super.id;
    }

    get status () {
        return this.#status;
    }

    // public
    // XXX
    updateTelegramBotUserFields ( fields ) {
        if ( "status" in fields ) this.#status = fields.status;
    }

    // XXX
    toJSON () {

        // const data = super.toJSON();
        // data.telegram_user_id = data.id;
        // data.id = this.id;
        // data.avatar_url = this.avatarUrl;
        // return data;
    }
}
