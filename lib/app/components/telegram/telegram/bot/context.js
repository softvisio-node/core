export default class TelegeamBotContext {
    #bot;
    #req;
    #user;
    #newUser;

    constructor ( bot, { req, user, newUser } = {} ) {
        this.#bot = bot;
        this.#req = req;
        this.#user = user;
        this.#newUser = newUser;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get isAborted () {
        return this.#req.isAborted;
    }

    get req () {
        return this.#req;
    }

    get user () {
        return this.#user;
    }

    get isNewUser () {
        return this.#newUser;
    }
}
