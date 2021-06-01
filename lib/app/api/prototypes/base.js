export default class {
    #app;
    #api;
    #dbh;

    constructor ( api ) {
        this.#api = api;
    }

    get app () {
        return this.#api.app;
    }

    get api () {
        return this.#api;
    }

    get dbh () {
        return this.#api.app.dbh;
    }
}
