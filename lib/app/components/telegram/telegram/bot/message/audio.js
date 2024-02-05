import Media from "./media.js";

const TYPE = "audio";

export default class extends Media {
    #thumbnail;
    #title;

    constructor ( { fileId, thumbnail, title } = {} ) {
        super( fileId );

        this.#thumbnail = thumbnail;
        this.#title = title;
    }

    // properties
    get type () {
        return TYPE;
    }

    // public
    toJSON () {
        const json = super.toJSON();

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;
        if ( this.#title ) json.title = this.#title;

        return json;
    }

    toMediaGroupItem () {
        const json = super.toMediaGroupItem();

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;
        if ( this.#title ) json.title = this.#title;

        return json;
    }
}
