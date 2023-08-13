import mixins from "#lib/mixins";
import fetch from "#lib/fetch";
import Mutex from "#lib/mutex";

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
    #mutex = new Mutex();

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
        return this._request(
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

    // https://core.telegram.org/bots/api#getfile
    async getFile ( fileId ) {
        if ( !this.#mutex.tryLock() ) return this.#mutex.wait();

        var res;

        try {
            res = await this._request( "getFile", {
                "file_id": fileId,
            } );

            if ( !res.ok ) throw res;

            const res1 = await fetch( `https://api.telegram.org/file/bot${this.#apiKey}/${res.data.file_path}` );

            if ( !res1.ok ) throw res1;

            const tmp = await res1.tmpFile();

            res.data.file = tmp;

            res = result( 200, res.data );
        }
        catch ( e ) {
            res = result.catch( e, { "silent": true, "keepError": true } );
        }

        this.#mutex.unlock( res );

        return res;
    }

    // https://core.telegram.org/bots/api#answercallbackquery
    async answerCallbackQuery () {}

    // https://core.telegram.org/bots/api#getuserprofilephotos
    async getUserProfilePhotos () {}

    // protected
    async _request ( method, body, signal ) {
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
}
