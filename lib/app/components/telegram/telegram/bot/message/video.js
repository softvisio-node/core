import Media from "./media.js";

const TYPE = "video",
    SEND_METHOD = "sendVideo";

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

    // public
    toJSON () {
        const json = {};

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;
        if ( this.#hasSpoiler ) json.hasSpoiler - true;

        return json;
    }

    toMessage () {
        const json = {};

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;
        if ( this.#hasSpoiler ) json.has_spoiler - true;

        return json;
    }
}
