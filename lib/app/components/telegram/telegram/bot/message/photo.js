import Media from "./media.js";

const TYPE = "photo",
    SEND_METHOD = "sendPhoto";

export default class extends Media {
    #thumbnail;
    #hasSpoiler;

    constructor ( { fileId, thumbnail, hasSpoiler } = {} ) {
        super( fileId );

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

    // protected
    _getJson () {
        const json = {};

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;
        if ( this.#hasSpoiler ) json.hasSpoiler - true;

        return json;
    }

    _toMessage () {
        const json = {};

        if ( this.#hasSpoiler ) json.has_spoiler - true;

        return json;
    }
}
