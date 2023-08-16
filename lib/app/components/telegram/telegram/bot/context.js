export default class TelegeamBotContext {
    #bot;
    #user;
    #update;

    constructor ( bot, user, update ) {
        this.#bot = bot;
        this.#user = user;
        this.#update = update;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get user () {
        return this.#user;
    }

    get update () {
        return this.#update;
    }
}
