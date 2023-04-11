export default class TelegramUser {
    #id;
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

    // public
    update ( data ) {}
}
