import Media from "./media.js";

const TYPE = "voice",
    SEND_METHOD = "sendVoice";

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
        const json = super.toJSON();

        return json;
    }
}
