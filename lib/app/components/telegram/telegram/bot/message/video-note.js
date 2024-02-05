import Media from "./media.js";

const TYPE = "videoNote",
    MEDIA_TYPE = "video_note",
    SEND_METHOD = "sendVideoNote";

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

    get MediaType () {
        return MEDIA_TYPE;
    }

    get sendMethod () {
        return SEND_METHOD;
    }

    // protected
    _getJson () {
        return {
            "thumbnail": this.#thumbnail,
        };
    }

    _toMessage () {
        return {};
    }
}
