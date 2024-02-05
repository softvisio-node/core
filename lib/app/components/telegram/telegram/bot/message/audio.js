import Media from "./media.js";

const TYPE = "audio";

export default class extends Media {
    constructor ( { fileId } = {} ) {
        super( fileId );
    }

    // properties
    get type () {
        return TYPE;
    }

    // public
    toJSON () {
        const json = super.toJSON();

        return json;
    }

    toMediaGroupItem () {
        const json = super.toMediaGroupItem();

        return json;
    }
}
