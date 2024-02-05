import Media from "./media.js";

const TYPE = "videoNote";

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

    get mediaType () {
        return "video_note";
    }

    // public
    toJSON () {
        const json = super.toJSON();

        if ( this.#spoiler ) json.spoiler - true;

        return json;
    }
}
