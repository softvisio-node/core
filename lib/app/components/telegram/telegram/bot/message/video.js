import Media from "./media.js";

const TYPE = "video";

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
