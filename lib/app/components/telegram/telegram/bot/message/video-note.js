import Media from "./media.js";

const TYPE = "video_note",
    SEND_METHOD = "sendVideoNote";

export default class extends Media {
    constructor ( { fileId } = {} ) {
        super( fileId );
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

        return json;
    }
}
