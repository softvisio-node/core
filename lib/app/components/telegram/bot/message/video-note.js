import Media from "./media.js";

const TYPE = "videoNote",
    MEDIA_TYPE = "video_note",
    SEND_METHOD = "sendVideoNote";

export default class extends Media {
    #thumbnailFileId;

    constructor ( id, { fileId, thumbnailFileId } = {} ) {
        super( id, fileId );

        this.#thumbnailFileId = thumbnailFileId;
    }

    // properties
    get type () {
        return TYPE;
    }

    get mediaType () {
        return MEDIA_TYPE;
    }

    get sendMethod () {
        return SEND_METHOD;
    }

    get supportCaption () {
        return false;
    }

    // protected
    _getJson () {
        return {
            "thumbnailFileId": this.#thumbnailFileId,
        };
    }

    _toMessage () {
        return {};
    }
}
