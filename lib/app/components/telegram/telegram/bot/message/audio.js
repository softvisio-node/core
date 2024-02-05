import Media from "./media.js";

const TYPE = "audio";

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
    toJson () {
        return {
            "type": this.type,
            "spoiler": this.#spoiler,
        };
    }

    toMediaGroupItem () {
        const json = super.toMediaGroupItem();

        if ( this.#spoiler ) json.has_spoiler = true;

        return json;
    }
}
