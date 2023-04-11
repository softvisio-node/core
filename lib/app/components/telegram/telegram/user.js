export default class TelegramUser {
    #id;
    #username;
    #firstName;
    #lastName;
    #phone;

    constructor ( options ) {
        this.#id = options.id;

        this.updateFields( options );
    }

    // properties
    get id () {
        return this.#id;
    }

    // public
    updateFields ( options ) {}
}
