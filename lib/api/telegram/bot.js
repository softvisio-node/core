import mixins from "#lib/mixins";
import fetch from "#lib/fetch";
import File from "#lib/file";
import FormData from "#lib/form-data";

import Chats from "./bot/chats.js";
import Forums from "./bot/forums.js";
import Games from "./bot/games.js";
import Inline from "./bot/inline.js";
import Location from "./bot/location.js";
import Me from "./bot/me.js";
import Messages from "./bot/messages.js";
import Payments from "./bot/payments.js";
import Polls from "./bot/polls.js";
import Stickers from "./bot/stickers.js";
import TelegramPassport from "./bot/telegram-passport.js";
import WebApps from "./bot/web-apps.js";
import WebHooks from "./bot/web-hooks.js";

const DEFAULT_UPDATES_LIMIT = 100,
    DEFAULT_UPDATES_TIMEOUT = 0;

export default class TelegramBotApi extends mixins( Chats, Forums, Games, Inline, Location, Me, Messages, Payments, Polls, Stickers, TelegramPassport, WebApps, WebHooks ) {
    #apiKey;

    constructor ( apiKey ) {
        super();

        this.#apiKey = apiKey;
    }

    // properties
    get apiKey () {
        return this.#apiKey;
    }

    set apiKey ( apiKey ) {
        this.#apiKey = apiKey;
    }

    // public
    // https://core.telegram.org/bots/api#getupdates
    async getUpdates ( { offset, limit, timeout, allowedUpdates, signal } = {} ) {
        return this.#request(
            "getUpdates",
            {
                offset,
                "limit": limit || DEFAULT_UPDATES_LIMIT,
                "timeout": timeout || DEFAULT_UPDATES_TIMEOUT,
                "allowed_updates": allowedUpdates,
            },
            signal
        );
    }

    // https://core.telegram.org/bots/api#answercallbackquery
    async answerCallbackQuery () {}

    // https://core.telegram.org/bots/api#getuserprofilephotos
    async getUserProfilePhotos () {}

    // XXX - remove
    async send ( method, data ) {
        if ( method === "sendPhoto" ) {
            if ( data.photo instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendVideo" ) {
            if ( data.video instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendDocument" ) {
            if ( data.document instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendAudio" ) {
            if ( data.audio instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendAnimation" ) {
            if ( data.animation instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendVoice" ) {
            if ( data.voice instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendVideoNote" ) {
            if ( data.video_note instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );
        }
        else if ( method === "sendMediaGroup" ) {
            let formData;

            for ( let n = 0; n < data.media.length; n++ ) {
                if ( data.media[n].media instanceof File || data.media[n].thumb instanceof File ) {
                    formData ??= {
                        ...data,
                        "media": [...data.media],
                    };

                    formData.media[n] = { ...data.media[n] };

                    if ( data.media[n].media instanceof File ) {
                        formData.media[n].media = `attach://media_${n}`;
                        formData["media_" + n] = data.media[n].media;
                    }

                    if ( data.media[n].thumb instanceof File ) {
                        formData.media[n].thumb = `attach://thumb_${n}`;
                        formData["thumb_" + n] = data.media[n].thumb;
                    }
                }
            }

            if ( formData ) data = this.#createFormData( formData );
        }

        return this.#request( method, data );
    }

    // XXX - ???, rename
    async sendMessage ( chatId, text ) {
        return this.#request( "sendMessage", {
            "chat_id": chatId,
            text,
        } );
    }

    // XXX mutex
    // https://core.telegram.org/bots/api#getfile
    async getFile ( fileId ) {
        const res = await this.send( "getFile", {
            "file_id": fileId,
        } );

        if ( !res.ok ) return res;

        const res1 = await fetch( `https://api.telegram.org/file/bot${this.#apiKey}/${res.data.file_path}` );

        if ( !res1.ok ) return res;

        try {
            const tmp = await res1.tmpFile();

            res.data.file = tmp;

            return result( 200, res.data );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    // private
    async #request ( method, body, signal ) {
        const headers = {};

        if ( !( body instanceof FormData ) ) {
            headers["Content-Type"] = "application/json";

            body = JSON.stringify( body );
        }

        const res = await fetch( `https://api.telegram.org/bot${this.#apiKey}/${method}`, {
            "method": "post",
            signal,
            headers,
            body,
        } );

        // aborted by abort signal
        if ( signal?.aborted ) return result( res );

        try {
            const data = await res.json();

            if ( !data.ok ) return result( [res.status, data.description] );

            return result( 200, data.result );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    #createFormData ( data ) {
        const formData = new FormData();

        for ( const [name, value] of Object.entries( data ) ) {
            if ( value instanceof File ) {
                formData.append( name, value );
            }
            else if ( typeof value === "object" ) {
                formData.append( name, JSON.stringify( value ) );
            }
            else {
                formData.append( name, value );
            }
        }

        return formData;
    }
}
