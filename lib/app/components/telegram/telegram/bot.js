export default class TelegramBot {
    #app;
    #telegram;
    #dbh;
    #id;

    constructor ( telegram, id ) {
        this.#app = telegram.app;
        this.#telegram = telegram;
        this.#dbh = telegram.dbh;
        this.#id = id;
    }

    // properties
    get app () {
        return this.#app;
    }

    get telegram () {
        return this.#telegram;
    }

    get dbh () {
        return this.#dbh;
    }

    get id () {
        return this.#id;
    }
}
