export default class {
    #fileId;

    constructor ( fileId ) {
        this.#fileId = fileId;
    }

    // properties
    get mediaType () {
        return this.type;
    }

    get fileId () {
        return this.#fileId;
    }

    // public
    toJSON () {
        const json = this._getJson();

        json.type = this.type;
        json.fileId = this.#fileId;

        return json;
    }
}
