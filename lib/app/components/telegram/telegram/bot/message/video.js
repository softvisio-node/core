import Media from "./media.js";

const TYPE = "video",
    SEND_METHOD = "sendVideo";

export default class extends Media {
    #thumbnail;
    #spoiler;

    constructor ( { fileId, thumbnail, "has_spoiler": hasSpoiler } = {} ) {
        super( fileId );

        this.#thumbnail = thumbnail;
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

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;
        if ( this.#spoiler ) json.has_spoiler - true;

        return json;
    }
}
