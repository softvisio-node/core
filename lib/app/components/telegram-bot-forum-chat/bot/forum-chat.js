export default class {
    #bot;

    constructor ( bot, fields ) {
        this.#bot = bot;
    }

    // proprties
    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.sbh;
    }

    // public
    updateFields ( fields ) {}
}
