import Bot from "./telegram/bot.js";

export default class {
    #app;
    #config;
    #dbh;

    constructor ( app, config ) {
        this.#app = app;
        this.#config = config;
        this.#dbh = app.dbh;
    }

    // public
    get app () {
        return this.#app;
    }

    get config () {
        return this.#config;
    }

    get dbh () {
        return this.#dbh;
    }

    get Bot () {
        return Bot;
    }

    // public
    async init () {
        return result( 200 );
    }

    async run () {
        return result( 200 );
    }
}
