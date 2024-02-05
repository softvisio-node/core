import Media from "./media.js";

const TYPE = "document",
    SEND_METHOD = "sendDocument";

export default class extends Media {
    #thumbnail;

    constructor ( { fileId, thumbnail } = {} ) {
        super( fileId );

        this.#thumbnail = thumbnail;
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

        return json;
    }
}
