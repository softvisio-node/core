import TelegramClient from "#lib/api/telegram/client";

export default class extends TelegramClient {
    #clients;
    #id;
    #username;
    #isBot;
    #isStatic;

    constructor ( clients, { id, username, isBot, isStatic, session } = {} ) {
        super( {
            "apiId": clients.telegram.config.app.apiId,
            "apiHash": clients.telegram.config.app.apiHash,
            session,
        } );

        this.#clients = clients;
        this.#id = id;
        this.#username = username;
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

    get username () {
        return this.#username;
    }

    get isBot () {
        return this.#isBot;
    }

    get isStatic () {
        return this.#isStatic;
    }

    // public
    updateFields ( fields ) {
        if ( "username" in fields ) {
            this.#username = fields.username;
        }
    }
}
