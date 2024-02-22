export default class {
    #bot;

    constructor ( bot ) {
        this.#bot = bot;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    // public
    getMessage () {}
}
