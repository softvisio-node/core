import Media from "./media.js";

const TYPE = "voice",
    SEND_METHOD = "sendVoice";

export default class extends Media {
    #contentType;

    constructor ( { fileId, contentType } = {} ) {
        super( fileId );

        this.#contentType = contentType;
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
        };
    }

    _getMessage () {
        return {};
    }
}
