export default class {
    #backend;

    constructor ( backend ) {
        this.#backend = backend;
    }

    // properties
    get app () {
        return this.#backend.app;
    }

    get api () {
        return this.#backend.api;
    }

    get backend () {
        return this.#backend;
    }

    get dbh () {
        return this.#backend.api.dbh;
    }

    // public
    async init () {
        return result( 200 );
    }
}
