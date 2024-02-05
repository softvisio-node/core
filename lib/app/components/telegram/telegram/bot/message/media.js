export default class {
    #fileId;

    constructor ( fileId ) {
        this.#fileId = fileId;
    }

    // properties
    get fileId () {
        return this.#fileId;
    }

    // public
    toMediaGroupItem () {
        return {
            "type": this.type,
            "media": this.#fileId,
        };
    }
}
