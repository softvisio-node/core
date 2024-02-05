import Media from "./media.js";

const TYPE = "document",
    SEND_METHOD = "sendDocument";

export default class extends Media {
    #fileName;

    constructor ( { fileId, fileName } = {} ) {
        super( fileId );

        this.#fileName = fileName;
    }

    // properties
    get type () {
        return TYPE;
    }

    get sendMethod () {
        return SEND_METHOD;
    }

    // public
    toJSON () {
        return {
            "fileName": this.#fileName,
        };
    }

    getMessage () {
        return {};
    }
}
