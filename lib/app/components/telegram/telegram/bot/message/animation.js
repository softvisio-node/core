import Media from "./media.js";

const TYPE = "animation",
    SEND_METHOD = "sendAnimation";

export default class extends Media {
    #contentType;
    #fileName;
    #thumbnailFileId;
    #hasSpoiler;

    constructor ( { fileId, contentType, fileName, thumbnailFileId, hasSpoiler } = {} ) {
        super( fileId );

        this.#contentType = contentType;
        this.#fileName = fileName;
        this.#thumbnailFileId = thumbnailFileId;
        this.#hasSpoiler = !!hasSpoiler;
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
            "fileName": this.#fileName,
            "thumbnailFileId": this.#thumbnailFileId,
            "hasSpoiler": this.#hasSpoiler,
        };
    }

    _toMessage () {
        const json = {};

        if ( this.#thumbnailFileId ) json.thumbnail = this.#thumbnailFileId;
        if ( this.#hasSpoiler ) json.has_spoiler - true;

        return json;
    }
}
