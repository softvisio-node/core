import sql from "#lib/sql";
import RequestMessage from "./request/message.js";
import Media from "./message/media.js";

import Animation from "./message/animation.js";
import Audio from "./message/audio.js";
import Document from "./message/document.js";
import Photo from "./message/photo.js";
import Video from "./message/video.js";
import VideoNote from "./message/video-note.js";
import Voice from "./message/voice.js";

const MEDIA_TYPE = {
    "animation": Animation,
    "audio": Audio,
    "document": Document,
    "photo": Photo,
    "video": Video,
    "videoNote": VideoNote,
    "voice": Voice,
};

const MEDIA_GROUP_TYPE = {
    "audio": new Set( [ "audio" ] ),
    "document": new Set( [ "document" ] ),
    "photo": new Set( [ "photo", "video" ] ),
    "video": new Set( [ "photo", "video" ] ),
};

const SQL = {
    "insertMessage": sql`INSERT INTO telegram_bot_message ( telegram_bot_id, data ) VALUES ( ?, ? ) RETURNING id `.prepare(),

    "updateMessage": sql`UPDATE telegram_bot_message SET data = ? WHERE id = ?`.prepare(),
};

export default class TelegramBotMessage {
    #bot;
    #id;
    #text;
    #parseMode;
    #media;

    constructor ( bot, { id, text, parseMode, media } = {} ) {
        this.#bot = bot;
        this.#id = id;

        this.#text = text;
        this.#parseMode = parseMode;

        if ( media ) {
            for ( const item of media ) {
                this.addMedia( item.type, item );
            }
        }
    }

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

    get isEmpty () {
        return !this.#text && !this.#media;
    }

    get isMedia () {
        return !!this.#media;
    }

    get isMediaGroup () {
        return this.#media?.length > 1;
    }

    get sendMethod () {
        if ( !this.#media ) {
            return "sendMessage";
        }
        else if ( this.#media.length === 1 ) {
            return this.#media[ 0 ].sendMethod;
        }
        else {
            return "sendMediaGroup";
        }
    }

    get text () {
        return this.#text;
    }

    set text ( value ) {
        this.#text = value || undefined;
    }

    get parseMode () {
        return this.#parseMode;
    }

    set parseMode ( value ) {
        this.#parseMode = value || undefined;
    }

    // public
    toJSON () {
        const data = {
            "text": this.#text,
            "parseMode": this.#parseMode,
            "media": this.#media,
        };

        return data;
    }

    toMessage () {
        var json;

        if ( !this.#media ) {
            json = {};

            if ( this.#text ) json.text = this.#text;
            if ( this.#parseMode ) json.parse_mode = this.#parseMode;
        }
        else if ( this.#media.length === 1 ) {
            const media = this.#media[ 0 ];

            json = media.toMessage();

            if ( media.supportCaption ) {
                if ( this.#text ) json.caption = this.#text;
                if ( this.#parseMode ) json.parse_mode = this.#parseMode;
            }
        }
        else {
            json = {};

            json.media = this.#media.map( media => media.toMediGroupItem() );

            if ( this.#text ) json.media[ 0 ].caption = this.#text;
            if ( this.#parseMode ) json.media[ 0 ].parse_mode = this.#parseMode;
        }

        return json;
    }

    addMedia ( type, options ) {
        const media = this.#createMedia( type, options );

        if ( !media ) return;

        if ( !this.#media ) {
            this.setMedia( media );
        }
        else if ( MEDIA_GROUP_TYPE[ media.type ]?.has( this.#media[ 0 ].type ) ) {
            this.#addMedia( media );
        }
        else {
            this.setMedia( media );
        }
    }

    setMedia ( type, options ) {
        const media = this.#createMedia( type, options );

        if ( !media ) return;

        this.#media = [ media ];
    }

    clearMedia () {
        this.#media = undefined;
    }

    deleteMedia ( index ) {
        if ( this.#media ) {
            this.#media.splice( index, 1 );

            if ( !this.#media.length ) this.clearMedia();
        }
    }

    setMediaIndex ( oldIndex, newIndex ) {
        const media = this.#media?.[ oldIndex ];

        if ( !media ) return;

        this.#media.splice( oldIndex, 1 );

        this.#media.splice( newIndex, 0, media );
    }

    async save ( { dbh } = {} ) {
        var res;

        dbh ||= this.dbh;

        if ( this.#id ) {
            res = await dbh.do( SQL.updateMessage, [ this, this.#id ] );
        }
        else {
            res = await dbh.selectRow( SQL.insertMessage, [ this.#bot.id, this ] );

            if ( res.ok ) this.#id = res.data.id;
        }

        return res;
    }

    [ Symbol.iterator ] () {
        return ( this.#media || [] ).values();
    }

    // private
    #createMedia ( type, options = {} ) {
        if ( type instanceof Media ) return type;

        if ( type instanceof RequestMessage ) {
            if ( MEDIA_TYPE[ type.type ] ) {
                options.fileId = type.fileId;
                options.contentType = type.contentType;
                options.fileName = type.fileName;
                options.thumbnailFileId = type.thumbnailFileId;
                options.title = type.audio?.title;

                type = type.type;
            }
            else {
                return;
            }
        }

        return new MEDIA_TYPE[ type ]( options );
    }

    #addMedia ( type, options = {} ) {
        const media = this.#createMedia( type, options );

        if ( !media ) return;

        if ( index == null ) {
            this.#media.push( media );

            if ( this.#media.length === 11 ) this.#media.shift();
        }
        else {
            var index = options.index || 9;
            if ( index > 9 ) index = 9;

            this.#media.splice( index, 0, media );

            if ( this.#media.length === 11 ) this.#media.pop();
        }
    }
}
