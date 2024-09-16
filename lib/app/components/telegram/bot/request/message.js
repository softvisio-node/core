const MEDIA_TYPES = [

        //
        "animation",
        "audio",
        "contact",
        "document",
        "location",
        "photo",
        "poll",
        "video",
        "video_note",
        "voice",
    ],
    TYPES = {
        "video_note": "videoNote",
    },
    IMAGE_CONTENT_TYPE = "image/jpeg";

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
        return this.#data.message_id;
    }

    get threadId () {
        return this.#data.message_thread_id;
    }

    get from () {
        return this.#data.from;
    }

    get chat () {
        return this.#data.chat;
    }

    get date () {
        return new Date( this.#data.date );
    }

    get mediaType () {
        if ( this.#mediaType === undefined ) {
            this.#mediaType = null;

            if ( this.#data.text ) {
                this.#mediaType = "text";
            }
            else {
                for ( const type of MEDIA_TYPES ) {
                    if ( this.#data[ type ] ) {
                        this.#mediaType = type;

                        break;
                    }
                }
            }
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

    get isMedia () {
        return !this.isText;
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

    get entities () {
        return this.#data.entities;
    }

    get audio () {
        return this.#data.audio;
    }

    get contact () {
        return this.#data.contact;
    }

    get location () {
        return this.#data.location;
    }

    get fileId () {
        if ( this.isPhoto ) {
            return this.#data.photo.at( -1 ).file_id;
        }
        else {
            return this.#data[ this.type ]?.file_id;
        }
    }

    get fileName () {
        return this.#data[ this.type ]?.file_name;
    }

    get contentType () {
        if ( this.isPhoto ) {
            return IMAGE_CONTENT_TYPE;
        }
        else {
            return this.#data[ this.type ]?.media_type;
        }
    }

    get thumbnailFileId () {
        if ( this.isPhoto ) {
            return this.#data.photo[ 0 ].file_id;
        }
        else {
            return this.#data[ this.type ]?.thumbnail?.file_id;
        }
    }

    get hasSpoiler () {
        return this.#data.has_media_spoiler;
    }

    get thumbnailContentType () {
        if ( this.thumbnailFileId ) {
            return IMAGE_CONTENT_TYPE;
        }
        else {
            return null;
        }
    }
}
