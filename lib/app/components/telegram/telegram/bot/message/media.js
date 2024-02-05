export default class {
    #fileId;

    constructor ( fileId ) {
        this.#fileId = fileId;
    }

    // properties
    get fileId () {
        return this.#fileId;
    }
}
