export default class TelegramBotUpdate {
    #bot;
    #update;

    constructor ( bot, update ) {
        this.#bot = bot;
        this.#update = update;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get id () {
        return this.#update.update_id;
    }
}
