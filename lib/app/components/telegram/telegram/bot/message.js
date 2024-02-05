import sql from "$lib/sql";

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

const MEDIA_GROUP_TYPE = {
    "audio": new Set( [ "audio" ] ),
    "document": new Set( [ "document" ] ),
    "photo": new Set( [ "photo", "video" ] ),
    "video": new Set( [ "photo", "video" ] ),
};

const SQL = {
    "imsertMessage": sql`INSERT INTO telegram_bot_message ( telegram_bot_id, data ) VALUES ( ?, ? ) RETURNING id `.prepare(),

    "updateMessage": sql`UPDATE telegram_bot_message SET data = ? WJERE id = ?`.prepare(),
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
                this.#media.push( new MEDIA_TYPE[ item.type ]( item ) );
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
        this.#text = value || null;
    }

    get parseMode () {
        return this.#parseMode;
    }

    set parseMode ( value ) {
        this.#parseMode = value || null;
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
        var json;

        if ( !this.#media ) {
            json = {};

            if ( this.#text ) json.text = this.#text;
            if ( this.#parseMode ) json.parse_mode = this.#parseMode;
        }
        else if ( this.#media.length === 1 ) {
            json = this.#media[ 0 ].toMessage();

            json[ this.#media[ 0 ].mediaType ] = this.#media[ 0 ].fileId;

            if ( this.#text ) json.caption = this.#text;
            if ( this.#parseMode ) json.parse_mode = this.#parseMode;
        }
        else {
            json = {};

            json.media = this.#media.map( media => {
                const json = media.toMessage();

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
        if ( !this.#media ) {
            return this.setMedia( type, options );
        }
        else if ( MEDIA_GROUP_TYPE[ type ]?.has( this.#media[ 0 ].type ) ) {
            this.#addMedia( type, options );
        }
        else {
            this.setMedia( type, options );
        }
    }

    setMedia ( type, options ) {
        this.#media = [ new MEDIA_TYPE[ type ]( options ) ];
    }

    clearMedia () {
        this.#media = null;
    }

    deleteMedia ( index ) {
        if ( !this.#media ) {
            return;
        }
        else {
            this.#media.splice( index, 1 );

            if ( !this.#media.length ) this.clearMedia();
        }
    }

    // XXX
    setMediaIndex ( oldIndex, newIndex ) {}

    async save ( { dbh } = {} ) {
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

        const json = JSON.stringify( data );

        var res;

        dbh ||= this.dbh;

        if ( this.#id ) {
            res = await dbh.do( SQL.updateMessagem[ ( json, this.#id ) ] );
        }
        else {
            res = await dbh.selectRow( SQL.insertMessagem[ ( this.#bot.id, json ) ] );

            if ( res.ok ) this.#id = res.data.id;
        }

        return res;
    }

    // private
    #addMedia ( type, options ) {
        if ( this.#media.length >= 10 ) this.#media.splice( 9 );

        this.#media.push( new MEDIA_TYPE[ type ]( options ) );
    }
}
