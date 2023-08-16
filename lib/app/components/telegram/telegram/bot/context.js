export default class TelegeamBotContext {
    #bot;
    #signal;
    #update;
    #user;
    #newUser;

    constructor ( bot, signal, { update, user, newUser } = {} ) {
        this.#bot = bot;
        this.#signal = signal;
        this.#update = update;
        this.#user = user;
        this.#newUser = newUser;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get abortSignal () {
        return this.#signal;
    }

    get update () {
        return this.#update;
    }

    get user () {
        return this.#user;
    }

    get isNewUser () {
        return this.#newUser;
    }
}
