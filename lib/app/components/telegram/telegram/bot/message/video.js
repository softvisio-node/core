import Media from "./media.js";

const TYPE = "video",
    SEND_METHOD = "sendVideo";

export default class extends Media {
    #thumbnail;
    #spoiler;

    constructor ( { fileId, thumbnail, spoiler } = {} ) {
        super( fileId );

        this.#thumbnail = thumbnail;
        this.#spoiler = !!spoiler;
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
        const json = super.toJSON();

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;
        if ( this.#spoiler ) json.spoiler - true;

        return json;
    }

    toMediaGroupItem () {
        const json = super.toMediaGroupItem();

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;
        if ( this.#spoiler ) json.has_spoiler = true;

        return json;
    }
}
