export default class {
    #backend;

    condtructor ( backend ) {
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

    get config () {
        return this.#backend.api.config;
    }

    get dbh () {
        return this.#backend.api.dbh;
    }
}
