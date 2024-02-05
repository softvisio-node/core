import Media from "./media.js";

const TYPE = "videoNote";

export default class extends Media {
    constructor ( { fileId } = {} ) {
        super( fileId );
    }

    // properties
    get type () {
        return TYPE;
    }

    get mediaType () {
        return "video_note";
    }

    // public
    toJSON () {
        const json = super.toJSON();

        return json;
    }
}
