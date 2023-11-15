export default class TelegeamBotContext {
    #bot;
    #update;
    #user;
    #newUser;

    constructor ( bot, { update, user, newUser } = {} ) {
        this.#bot = bot;
        this.#update = update;
        this.#user = user;
        this.#newUser = newUser;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get isAborted () {
        return this.#update.isAborted;
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
