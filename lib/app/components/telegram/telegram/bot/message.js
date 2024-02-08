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

const PARSE_MODES = new Set( [ "HTML", "MarkdownV2" ] );

const SQL = {
    "insertMessage": sql`INSERT INTO telegram_bot_message ( telegram_bot_id, data ) VALUES ( ?, ? ) RETURNING id `.prepare(),

    "updateMessage": sql`UPDATE telegram_bot_message SET data = ? WHERE id = ?`.prepare(),
};

export default class TelegramBotMessage {
    #bot;
    #id;
    #text;
    #entities;
    #parseMode;
    #media;
    #index = {};
    #fileIdIndex = {};

    constructor ( bot, fields ) {
        this.#bot = bot;
        this.#id = fields?.id;

        this.updateFields( fields?.data );
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

    get entities () {
        return this.#entities;
    }

    set entities ( value ) {
        this.#entities = value || undefined;
    }

    get parseMode () {
        return this.#parseMode;
    }

    set parseMode ( value ) {
        if ( !PARSE_MODES.has( value ) ) return;

        this.#parseMode = value || undefined;
    }

    // public
    updateFields ( data ) {
        this.#text = data?.text;
        this.#entities = data.entities;
        this.#parseMode = data?.parseMode;
        this.#media = undefined;
        this.#index = {};
        this.#fileIdIndex = {};

        if ( data?.media ) {
            for ( const item of data.media ) {
                const media = this.#createMedia( item.type, item.id, item );

                this.addMedia( media );
            }
        }
    }

    toJSON () {
        const data = {
            "text": this.#text,
            "entities": this.#entities,
            "parseMode": this.#parseMode,
            "media": this.#media,
        };

        return data;
    }

    toMessage () {
        var json;

        if ( !this.#media ) {
            json = {};

            json.text = this.#text;
            json.entities = this.#entities;

            // json.parse_mode = this.#parseMode;
        }
        else if ( this.#media.length === 1 ) {
            const media = this.#media[ 0 ];

            json = media.toMessage();

            if ( media.supportCaption ) {
                json.caption = this.#text;
                json.caption_entities = this.#entities;

                // json.parse_mode = this.#parseMode;
            }
        }
        else {
            json = {};

            json.media = this.#media.map( media => media.toMediGroupItem() );

            json.media[ 0 ].caption = this.#text;
            json.media[ 0 ].caption_entities = this.#entities;

            // json.media[ 0 ].parse_mode = this.#parseMode;
        }

        return json;
    }

    addMedia ( type, options ) {
        const media = this.#createMedia( type, null, options );

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
        const media = this.#createMedia( type, null, options );

        if ( !media ) return;

        this.#media = [ media ];

        this.#index[ media.id ] = media;

        if ( media.fileId ) this.#fileIdIndex[ media.fileId ] = media;
    }

    deleteMedia ( id ) {
        const media = this.#getMedia( id );

        if ( !media ) return;

        this.#deleteMedia( media );
    }

    clearMedia () {
        this.#media = undefined;

        this.#index = {};

        this.#fileIdIndex = {};
    }

    moveMediaToStart ( id ) {
        if ( !this.#media || this.#media.length === 1 ) return;

        const media = this.#getMedia( id );

        if ( !media ) return;

        this.#addMedia( media, true );
    }

    moveMediaLeft ( id ) {
        if ( !this.#media || this.#media.length === 1 ) return;

        const media = this.#getMedia( id );

        if ( !media ) return;

        for ( let n = 0; n < this.#media.length; n++ ) {
            if ( media === this.#media[ n ] ) {
                if ( n ) {
                    this.#media[ n ] = this.#media[ n - 1 ];

                    this.#media[ n - 1 ] = media;
                }

                break;
            }
        }
    }

    moveMediaToEnd ( id ) {
        if ( !this.#media || this.#media.length === 1 ) return;

        const media = this.#getMedia( id );

        if ( !media ) return;

        this.#addMedia( media );
    }

    moveMediaRight ( id ) {
        if ( !this.#media || this.#media.length === 1 ) return;

        const media = this.#getMedia( id );

        if ( !media ) return;

        for ( let n = 0; n < this.#media.length; n++ ) {
            if ( media === this.#media[ n ] ) {
                if ( n !== this.#media.length - 1 ) {
                    this.#media[ n ] = this.#media[ n + 1 ];

                    this.#media[ n + 1 ] = media;
                }

                break;
            }
        }
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
    #getMedia ( id ) {
        if ( !this.#media ) return;

        return this.#index[ id ] || this.#fileIdIndex[ id ];
    }

    #deleteMedia ( media ) {
        delete this.#index[ media.id ];

        delete this.#fileIdIndex[ media?.fileId ];

        this.#media = this.#media.filter( item => item !== media );

        if ( !this.#media.length ) this.clearMedia();
    }

    #createMedia ( type, id, options = {} ) {
        if ( type instanceof Media ) return type;

        if ( type instanceof RequestMessage ) {
            if ( MEDIA_TYPE[ type.type ] ) {
                options.fileId = type.fileId;
                options.contentType = type.contentType;
                options.fileName = type.fileName;
                options.thumbnailFileId = type.thumbnailFileId;

                options.hasSpoiler ??= type.hasSpoiler;

                options.title = type.audio?.title;

                type = type.type;
            }
            else {
                return;
            }
        }

        return new MEDIA_TYPE[ type ]( id, options );
    }

    #addMedia ( media, addToStart ) {
        if ( this.#index[ media.id ] || this.#fileIdIndex[ media.fileId ] ) {
            this.#deleteMedia( media );
        }

        this.#media ||= [];

        if ( this.#media.length === 10 ) {
            if ( addToStart ) {
                this.#media.popt();
            }
            else {
                this.#media.shiftt();
            }
        }

        if ( addToStart ) {
            this.#media.unshift( media );
        }
        else {
            this.#media.push( media );
        }

        this.#index[ media.id ] = media;

        if ( media.fileId ) this.#fileIdIndex[ media.fileId ] = media;
    }
}
