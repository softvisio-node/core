import sql from "#lib/sql";
import Request from "./request.js";

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
            this.#media = [];

            for ( const item in media ) {
                this.#media.push( this.#createMedia( item.type, item ) );
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

    // public
    toJSON () {
        const data = {
            "text": this.#text,
            "parseMode": this.#parseMode,
        };

        if ( this.#media ) {
            data.media = this.#media.map( media => {
                const json = media.toJSON();

                json.type = media.type;
                json.fileId = media.fileId;

                return json;
            } );
        }

        return data;
    }

    getMessage () {
        var json;

        if ( !this.#media ) {
            json = {};

            if ( this.#text ) json.text = this.#text;
            if ( this.#parseMode ) json.parse_mode = this.#parseMode;
        }
        else if ( this.#media.length === 1 ) {
            const media = this.#media[ 0 ];

            json = media.getMessage();

            json[ media.mediaType ] = media.fileId;

            if ( this.#text ) json.caption = this.#text;
            if ( this.#parseMode ) json.parse_mode = this.#parseMode;
        }
        else {
            json = {};

            json.media = this.#media.map( media => {
                const json = media.getMessage();

                json.type = media.mediaType;
                json.media = media.fileId;

                return json;
            } );

            if ( this.#text ) json.media[ 0 ].caption = this.#text;
            if ( this.#parseMode ) json.media[ 0 ].parse_mode = this.#parseMode;
        }

        return json;
    }

    addMedia ( type, options ) {
        const media = this.#createMedia( type, options );

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
            res = await dbh.do( SQL.updateMessage, ( this, this.#id ) );
        }
        else {
            res = await dbh.selectRow( SQL.insertMessage, [ this.#bot.id, this ] );

            if ( res.ok ) this.#id = res.data.id;
        }

        return res;
    }

    // private
    #addMedia ( type, options = {} ) {
        var index = options.index || 9;
        if ( index > 9 ) index = 9;

        const media = this.#createMedia( type, options );

        if ( !media ) return;

        this.#media.splice( index, 0, media );

        if ( this.#media.length > 10 ) this.#media.length = 10;
    }

    #createMedia ( type, options = {} ) {
        if ( type instanceof Media ) return type;

        if ( type instanceof Request ) {
            if ( type.message.animation ) {
                options.fileId = type.message.animation.file_id;
                options.contentType = type.message.animation.mime_type;
                options.fileName = type.message.animation.file_name;
                options.thumbnail = type.message.animation.thumbnail.file_id;

                type = "animation";
            }
            else if ( type.message.audio ) {
                options.fileId = type.message.audio.file_id;
                options.contentType = type.message.audio.mime_type;
                options.title = type.message.audio.title;

                type = "audio";
            }
            else if ( type.message.document ) {
                options.fileId = type.message.document.file_id;
                options.contentType = type.message.document.mime_type;
                options.fileName = type.message.document.file_name;

                type = "document";
            }
            else if ( type.message.photo ) {
                options.fileId = type.message.photo[ type.message.photo.length - 1 ].file_id;
                options.thumbnail = type.message.photo[ 0 ].file_id;

                type = "photo";
            }
            else if ( type.message.video ) {
                options.fileId = type.message.video.file_id;
                options.contentType = type.message.video.mime_type;
                options.fileName = type.message.video.file_name;
                options.thumbnail = type.message.video.thumbnail.file_id;

                type = "video";
            }
            else if ( type.message.video_note ) {
                options.fileId = type.message.video_note.file_id;
                options.thumbnail = type.message.video_note.thumbnail.file_id;

                type = "videoNote";
            }
            else if ( type.message.voice ) {
                options.fileId = type.message.voice.file_id;
                options.contentType = type.message.voice.mime_type;

                type = "voice";
            }
            else {
                return;
            }
        }

        return new MEDIA_TYPE[ type ]( options );
    }
}
