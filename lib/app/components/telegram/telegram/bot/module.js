export default class {
    #bot;

    constructor ( bot ) {
        this.#bot = bot;
    }

    // properties
    get app () {
        return this.#bot.app;
    }

    get bot () {
        return this.#bot;
    }

    get telegram () {
        return this.#bot.telegram;
    }

    get dbh () {
        return this.#bot.app.dbh;
    }
}
