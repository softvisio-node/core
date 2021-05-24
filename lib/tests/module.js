export default class Module {
    #path;
    #name;

    constructor ( path, name ) {
        this.#path = path;
        this.#name = name;
    }

    get path () {
        return this.#path;
    }

    get name () {
        return this.#name;
    }
}
