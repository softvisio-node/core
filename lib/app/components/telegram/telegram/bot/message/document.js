import Media from "./media.js";

const TYPE = "document";

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

    // public
    toJSON () {
        const json = super.toJSON();

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;

        return json;
    }

    toMediaGroupItem () {
        const json = super.toMediaGroupItem();

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;

        return json;
    }
}
