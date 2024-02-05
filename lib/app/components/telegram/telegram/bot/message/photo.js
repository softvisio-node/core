import Media from "./media.js";

const TYPE = "photo",
    SEND_METHOD = "sendPhoto";

export default class extends Media {
    #hasSpoiler;

    constructor ( { fileId, hasSpoiler } = {} ) {
        super( fileId );

        this.#hasSpoiler = !!hasSpoiler;
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
        const json = {};

        if ( this.#hasSpoiler ) json.hasSpoiler - true;

        return json;
    }

    getMessage () {
        const json = {};

        if ( this.#hasSpoiler ) json.has_spoiler - true;

        return json;
    }
}
