const MEDIA_TYPES = [ "animation", "audio", "contact", "document", "photo", "video", "video_note", "voice" ],
    TYPES = {
        "video_note": "videoNote",
    };

export default class {
    #req;
    #data;
    #mediaType;
    #type;

    constructor ( req, data ) {
        this.#req = req;
        this.#data = data;
    }

    // properties
    get req () {
        return this.#req;
    }

    isAborted () {
        return this.#req.isAborted;
    }

    get data () {
        return this.#data;
    }

    get id () {
        return this.#data.id;
    }

    get mediaType () {
        if ( !this.#mediaType ) {
            for ( const type of MEDIA_TYPES ) {
                if ( this.#data[ type ] ) {
                    this.#mediaType = type;

                    break;
                }
            }

            this.#mediaType ||= "test";
        }

        return this.#mediaType;
    }

    get type () {
        this.#type ??= TYPES[ this.mediaType ] || this.mediaType;

        return this.#type;
    }

    get isText () {
        return this.type === "text";
    }

    get isPhoto () {
        return this.type === "photo";
    }

    get text () {
        if ( this.isText ) {
            return this.#data.text;
        }
        else {
            return this.#data.caption;
        }
    }

    get contact () {
        return this.#data.contact;
    }

    get fileId () {
        if ( this.isPhoto ) {
            return this.#data.photo[ this.#data.photo.length - 1 ].file_id;
        }
        else {
            return this.#data[ this.type ]?.file_id;
        }
    }

    get filename () {
        return this.#data[ this.type ]?.file_name;
    }

    get contentType () {
        return this.#data[ this.type ]?.media_type;
    }

    get thumbnailFileId () {
        if ( this.isPhoto ) {
            return this.#data.photo[ 0 ].file_id;
        }
        else {
            return this.#data[ this.type ]?.thumbnail?.file_id;
        }
    }
}
