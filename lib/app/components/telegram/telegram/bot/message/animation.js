import Media from "./media.js";

const TYPE = "animation",
    SEND_METHOD = "sendAnimation";

export default class extends Media {
    #contentType;
    #fileName;
    #thumbnail;
    #hasSpoiler;

    constructor ( { fileId, contentType, fileName, thumbnail, hasSpoiler } = {} ) {
        super( fileId );

        this.#contentType = contentType;
        this.#fileName = fileName;
        this.#thumbnail = thumbnail;
        this.#hasSpoiler = !!hasSpoiler;
    }

    // properties
    get type () {
        return TYPE;
    }

    get sendMethod () {
        return SEND_METHOD;
    }

    // private
    _getJson () {
        return {
            "contentType": this.#contentType,
            "fileName": this.#fileName,
            "thumbnail": this.#thumbnail,
            "hasSpoiler": this.#hasSpoiler,
        };
    }

    getMessage () {
        const json = {};

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;
        if ( this.#hasSpoiler ) json.has_spoiler - true;

        return json;
    }
}
