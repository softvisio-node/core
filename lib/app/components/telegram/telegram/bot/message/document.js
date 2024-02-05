const TYPE = "document";

export default class {
    #fileId;
    #spoiler;

    constructor ( { fileId, spoiler } = {} ) {
        this.#fileId = fileId;
        this.#spoiler = !!spoiler;
    }

    // properties
    get type () {
        return TYPE;
    }

    // public
    toJson () {
        return {
            "type": this.type,
            "fileId": this.#fileId,
            "spoiler": this.#spoiler,
        };
    }

    toMediaGroupItem () {
        return {
            "type": this.type,
            "media": this.#fileId,
        };
    }
}
