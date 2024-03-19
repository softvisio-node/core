export default class {
    #telegram;

    constructor ( telegram ) {
        this.#telegram = telegram;
    }

    // properties
    get telegram () {
        return this.#telegram;
    }

    get app () {
        return this.#telegram.app;
    }

    get dbh () {
        return this.#telegram.app.dbh;
    }

    // public
    // XXX
    async init () {
        return result( 200 );
    }
}
