import Media from "./media.js";

const TYPE = "audio",
    SEND_METHOD = "sendAudio";

export default class extends Media {
    #contentType;
    #title;

    constructor ( id, { fileId, contentType, title } = {} ) {
        super( id, fileId );

        this.#contentType = contentType;
        this.#title = title;
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
            "contentType": this.#contentType,
            "title": this.#title,
        };
    }

    _toMessage () {
        return {
            "title": this.#title,
        };
    }
}
