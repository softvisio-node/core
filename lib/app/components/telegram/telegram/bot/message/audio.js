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
    toJson () {
        return {
            "type": this.type,
            "fileId": this.fileId,
        };
    }

    toMediaGroupItem () {
        const json = super.toMediaGroupItem();

        return json;
    }
}
