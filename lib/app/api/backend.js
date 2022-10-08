export default class {
    #api;

    constructor ( api ) {
        this.#api = api;
    }

    // properties
    get app () {
        return this.#api.app;
    }

    get api () {
        return this.#api;
    }

    get dbh () {
        return this.#api.app.dbh;
    }

    // public
    async init () {
        return result( 200 );
    }
}
