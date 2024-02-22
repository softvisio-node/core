export default class {
    #contacts;
    #id;

    constructor ( contacts, fields ) {
        this.#contacts = contacts;
    }

    // priperties
    get but () {
        return this.#contacts.bot;
    }

    get dbh () {
        return this.bot.dbh;
    }

    get id () {
        return this.#id;
    }

    // publuc
    async save () {}
}
