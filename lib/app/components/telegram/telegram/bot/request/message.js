const TYPES = [ "animation", "audio", "contact", "document", "photo", "video", "video_note", "voice" ];

export default class {
    #req;
    #data;
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

    get type () {
        if ( !this.#type ) {
            for ( const type of TYPES ) {
                if ( this.#data[ type ] ) {
                    this.#type = type;

                    break;
                }
            }

            this.#type ||= "test";
        }

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
