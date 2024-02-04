export default class TelegramBotMessage {
    #bot;
    #dataJson;
    #data;
    #type;

    constructor ( bot, fields ) {
        this.#bot = bot;

        if ( fields ) {
            this.#dataJson = fields.data;

            if ( this.#dataJson ) {
                this.#data = JSON.parse( this.#dataJson );
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

    get type () {
        if ( !this.#type ) {
            if ( this.#data.photo ) {
                this.#type = "photo";
            }
            else if ( this.#data.audio ) {
                this.#type = "audio";
            }
            else if ( this.#data.document ) {
                this.#type = "document";
            }
            else if ( this.#data.video ) {
                this.#type = "video";
            }
            else if ( this.#data.animation ) {
                this.#type = "animation";
            }
            else if ( this.#data.voice ) {
                this.#type = "voice";
            }
            else if ( this.#data.video_note ) {
                this.#type = "videoNote";
            }
            else if ( this.#data.media ) {
                this.#type = "media";
            }
            else {
                this.#type = "text";
            }
        }

        return this.#type;
    }

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

    get text () {
        if ( this.isText ) {
            return this.#data.text;
        }
        else if ( this.isMedia ) {
            return this.#data.media[ 0 ].caption;
        }
        else {
            return this.#data.caption;
        }
    }

    set text ( value ) {
        if ( this.type === "text" ) {
            this.#data.text = value;
        }
        else if ( this.isMedia ) {
            this.#data.media[ 0 ].caption = value;
        }
        else {
            this.#data.caption = value;
        }
    }

    get parseMode () {
        if ( this.isMedia ) {
            return this.#data.media[ 0 ].parse_mode;
        }
        else {
            return this.#data.parse_mode;
        }
    }

    set parseMode ( value ) {
        if ( this.isMedia ) {
            this.#data.media[ 0 ].parse_mode = value;
        }
        else {
            this.#data.parse_mode = value;
        }
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
    }
}
