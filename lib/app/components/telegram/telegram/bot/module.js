export default class {
    #bot;
    #id;

    constructor ( bot, id ) {
        this.#bot = bot;
        this.#id = id;
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

    get locale () {
        return this.#bot.locale;
    }

    get id () {
        return this.#id;
    }

    // public
    async run ( ctx ) {}

    // protected
    _encodeCallback ( method, ...args ) {
        if ( !method.startsWith( "/" ) ) method = this.id + "/" + method;

        return this.telegram.encodeCallback( method, args );
    }
}
