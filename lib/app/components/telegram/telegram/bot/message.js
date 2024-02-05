import Audio from "./message/audio.js";
import Document from "./message/document.js";
import Photo from "./message/photo.js";
import Video from "./message/video.js";
import VideoNote from "./message/video-note.js";
import Voice from "./message/voice.js";

const MEDIA_TYPE = {
    "audio": Audio,
    "document": Document,
    "photo": Photo,
    "video": Video,
    "videoNote": VideoNote,
    "voice": Voice,
};

export default class TelegramBotMessage {
    #bot;
    #id;
    #text;
    #parseMode;
    #media;

    // / XXX
    #dataJson;
    #data;
    #type;

    constructor ( bot, { id, text, parseMode, media } = {} ) {
        this.#bot = bot;
        this.#id = id;
        this.#text = text;
        this.#parseMode = parseMode;

        if ( media ) {
            this.#media = [];

            for ( const item in media ) {
                this.#media.push( new MEDIA_TYPE[ item.type ]( item ) );
            }
        }
    }

    // static
    fromData ( bot, data ) {}

    // properties
    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    get id () {
        return this.#id;
    }

    get text () {
        return this.#text;
    }

    get parseMode () {
        return this.#parseMode;
    }

    get type () {
        if ( this.#media ) {
            if ( this.#media.length === 1 ) {
                return this.#media[ 0 ].type;
            }
            else {
                return "mediaGroup";
            }
        }
        else {
            return "text";
        }
    }

    // XXX ------------------------------------

    get isText () {
        return this.type === "text";
    }

    get isPhoto () {
        return this.tyoe === "photo";
    }

    get isAudio () {
        return this.type === "audio";
    }

    get isDocument () {
        return this.type === "document";
    }

    get isVideo () {
        return this.type === "video";
    }

    get isAnimation () {
        return this.type === "animation";
    }

    get isVoice () {
        return this.type === "voice";
    }

    get isVideoNote () {
        return this.type === "videoNote";
    }

    // public
    setPhoto ( fileId, { spoiler } = {} ) {
        this.#type = "photo";

        this.#data = {
            "caption": this.text,
            "parse_mode": this.parseMode,

            "photo": fileId,
            "has_spoiler": !!spoiler,
        };
    }

    // XXX
    addPhoto ( fileId, { spoiler } = {} ) {
        if ( this.isMedia ) {
            if ( this.#data.media[ 0 ].type === "photo" || this.#data.media[ 0 ].type === "video" ) {
                if ( this.#data.media.length >= 10 ) {
                    this.#data.media.splice( 9 );
                }

                this.#data.media.push( {
                    "type": "photo",
                    "media": fileId,
                    "has_spoiler": !!spoiler,
                } );
            }
            else {
                return this.setPhoto( fileId, { spoiler } );
            }
        }
        else if ( this.isPhoto || this.isVideo ) {

            // XXX

            this.#type = "media";

            this.#data = {
                "caption": this.text,
                "parse_mode": this.parseMode,
                "photo": "",
                "has_spoiler": !!spoiler,
            };
        }
        else {
            return this.setPhoto( fileId, { spoiler } );
        }
    }

    clearMedia () {
        if ( this.isText ) return;

        this.#type = "text";

        this.#data = {
            "caption": this.text,
            "parse_mode": this.parseMode,
        };
    }

    deleteMedia ( index ) {
        if ( this.isText ) return;

        if ( index == null ) {
            return this.clearMedia();
        }
        else if ( this.isMedia ) {
            const text = this.text,
                parseMode = this.parseMode;

            this.#data.media.splice( index, 1 );

            if ( this.#data.media.length ) {
                this.#data.media[ 0 ].caption = text;
                this.#data.media[ 0 ].parse_mode = parseMode;
            }
            else {
                return this.clearMedia();
            }
        }
        else {
            return this.clearMedia();
        }
    }

    setMefiaIndex ( oldIndex, newIndex ) {}

    async save () {}

    // private
    #addMedia ( type, fileId, options = {} ) {
        if ( this.isMedia ) {

            // XXX
        }
        else {

            // XXX
        }
    }
}
