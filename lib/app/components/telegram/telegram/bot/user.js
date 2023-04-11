import TelegramUser from "../user.js";

export default class TelegramBotUser extends TelegramUser {
    #botId;
    #blocked;
    #banned;

    constructor ( data ) {
        super( data );

        this.#botId = data.telegram_bot_id;
    }

    // properties
    get botId () {
        return this.#botId;
    }

    get isBlocked () {
        return this.#blocked;
    }

    get isBanned () {
        return this.#banned;
    }

    // public
    update ( data ) {
        super.update( data );

        if ( "blocked" in data ) this.#blocked = data.blocked;
        if ( "banned" in data ) this.#banned = data.banned;
    }
}
