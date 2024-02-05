export default class {
    #fileId;

    constructor ( fileId ) {
        this.#fileId = fileId;
    }

    // properties
    get MediaType () {
        return this.type;
    }

    get fileId () {
        return this.#fileId;
    }

    // public
    getMessage () {
        return this.toJSON();
    }
}
