import Media from "./media.js";

const TYPE = "photo",
    SEND_METHOD = "sendPhoto";

export default class extends Media {
    #spoiler;

    constructor ( { fileId, "has_spoiler": hasSpoiler } = {} ) {
        super( fileId );

        this.#spoiler = !!hasSpoiler;
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

        if ( this.#spoiler ) json.has_spoiler - true;

        return json;
    }
}
