export default class TelegramUser {
    #id;
    #telegramId;
    #isBot;
    #username;
    #firstName;
    #lastName;
    #phone;

    constructor ( data ) {
        this.#id = data.id;

        this.update( data );
    }

    // properties
    get id () {
        return this.#id;
    }

    get telegramId () {
        return this.#telegramId;
    }

    get isBot () {
        return this.#isBot;
    }

    get username () {
        return this.#username;
    }

    get firstNmae () {
        return this.#firstName;
    }

    get lastName () {
        return this.#lastName;
    }

    get phone () {
        return this.#phone;
    }

    // public
    update ( data ) {}
}
