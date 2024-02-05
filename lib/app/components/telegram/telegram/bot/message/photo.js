import Media from "./media.js";

const TYPE = "photo",
    SEND_METHOD = "sendPhoto";

export default class extends Media {
    #spoiler;

    constructor ( { fileId, spoiler } = {} ) {
        super( fileId );

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

        if ( this.#spoiler ) json.spoiler - true;

        return json;
    }

    toMediaGroupItem () {
        const json = super.toMediaGroupItem();

        if ( this.#spoiler ) json.has_spoiler = true;

        return json;
    }
}
