import Media from "./media.js";

const TYPE = "document",
    SEND_METHOD = "sendDocument";

export default class extends Media {
    #fileName;

    constructor ( id, { fileId, fileName } = {} ) {
        super( id, fileId );

        this.#fileName = fileName;
    }

    // properties
    get type () {
        return TYPE;
    }

    get sendMethod () {
        return SEND_METHOD;
    }

    // protected
    _getJson () {
        return {
            "fileName": this.#fileName,
        };
    }

    _toMessage () {
        return {};
    }
}
