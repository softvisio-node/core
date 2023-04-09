export default class TelegramBotUser {
    #id;
    #botId;
    #username;
    #firstName;
    #lastName;
    #phone;
    #blocked;
    #banned;

    constructor ( options ) {
        this.#id = options.id;
        this.#botId = options.botId;

        this.updateFields( options );
    }

    // properties
    get id () {
        return this.#id;
    }

    get botId () {
        return this.#botId;
    }

    // public
    updateFields ( options ) {}
}
