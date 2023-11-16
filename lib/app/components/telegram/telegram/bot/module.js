import path from "node:path";

export default class {
    #bot;
    #id;

    constructor ( bot, id ) {
        this.#bot = bot;
        this.#id = id;
    }

    // properties
    get id () {
        return this.#id;
    }

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

    // public
    async run ( ctx, req ) {}

    async onModuleExit () {}

    l10nt ( ...args ) {
        return this.app.locale.l10nt( ...args );
    }

    encodeCallbackData ( method, ...args ) {
        if ( !method.startsWith( "/" ) ) method = path.posix.join( this.id, method );

        return this.bot.telegram.encodeCallback( method, ...args );
    }
}
