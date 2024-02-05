export default class {
    #fileId;

    constructor ( fileId ) {
        this.#fileId = fileId;
    }

    // properties
    get fileId () {
        return this.#fileId;
    }

    get mediaTyoe () {
        return this.type;
    }

    // public
    toJSON () {
        return {
            "type": this.type,
            "fileIs": this.#fileId,
        };
    }

    toMessage () {
        return {
            [ this.mediaType ]: this.#fileId,
        };
    }

    toMediaGroupItem () {
        return {
            "type": this.type,
            "media": this.#fileId,
        };
    }
}
