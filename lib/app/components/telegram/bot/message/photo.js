import Media from "./media.js";

const TYPE = "photo",
    SEND_METHOD = "sendPhoto";

export default class extends Media {
    #thumbnailFileId;
    #hasSpoiler;

    constructor ( id, { fileId, thumbnailFileId, hasSpoiler } = {} ) {
        super( id, fileId );

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
        const json = {};

        if ( this.#thumbnailFileId ) json.thumbnailFileId = this.#thumbnailFileId;
        if ( this.#hasSpoiler ) json.hasSpoiler = true;

        return json;
    }

    _toMessage () {
        const json = {};

        if ( this.#hasSpoiler ) json.has_spoiler = true;

        return json;
    }
}
