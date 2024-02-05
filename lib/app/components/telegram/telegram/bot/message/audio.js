import Media from "./media.js";

const TYPE = "audio",
    SEND_METHOD = "sendAudio";

export default class extends Media {
    #contentType;
    #title;

    constructor ( { fileId, contentType, title } = {} ) {
        super( fileId );

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

    // public
    toJSON () {
        return {
            "contentType": this.#contentType,
            "title": this.#title,
        };
    }

    getMessage () {
        return {
            "title": this.#title,
        };
    }
}
