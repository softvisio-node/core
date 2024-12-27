import TelegramClient from "#lib/api/telegram/client";

export default class extends TelegramClient {
    #clients;
    #id;
    #isBot;
    #isStatic;

    constructor ( clients, { id, "bot": isBot, "static": isStatic, session } = {} ) {
        super( {
            "apiId": clients.telegram.config.app.apiId,
            "apiHash": clients.telegram.config.app.apiHash,
            session,
        } );

        this.#clients = clients;
        this.#id = id;
        this.#isBot = isBot;
        this.#isStatic = isStatic;
    }

    // properties
    get app () {
        return this.#clients.app;
    }

    get id () {
        return this.#id;
    }

    get isBot () {
        return this.#isBot;
    }

    get isStatic () {
        return this.#isStatic;
    }
}
