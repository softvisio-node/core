import Media from "./media.js";

const TYPE = "audio",
    SEND_METHOD = "sendAudio";

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

    get sendMethod () {
        return SEND_METHOD;
    }

    // public
    toJSON () {
        const json = super.toJSON();

        if ( this.#thumbnail ) json.thumbnail = this.#thumbnail;
        if ( this.#title ) json.title = this.#title;

        return json;
    }

    toMessage () {
        const json = super.toMessage();

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
