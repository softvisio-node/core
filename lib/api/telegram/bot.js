import mixins from "#lib/mixins";
import fetch from "#lib/fetch";
import Mutex from "#lib/threads/mutex";

import Chats from "./bot/chats.js";
import Forums from "./bot/forums.js";
import Games from "./bot/games.js";
import InlineQuery from "./bot/inline-query.js";
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
    DEFAULT_UPDATES_TIMEOUT = 0,
    mutexSet = new Mutex.Set();

export default class TelegramBotApi extends mixins( Chats, Forums, Games, InlineQuery, Location, Me, Messages, Payments, Polls, Stickers, TelegramPassport, WebApps, WebHooks ) {
    #apiKey;
    #mutexSet = new Mutex.Set();

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
    async send ( method, data ) {
        return this[method]( data );
    }

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
    // XXX file unique id mutex
    async getFile ( fileId, { fileUniqueId } = {} ) {
        var fileUniqueIdMutex;

        const fileIdMutex = this.#mutexSet.get( "get-file/" + fileId );

        if ( !fileIdMutex.tryLock() ) return fileIdMutex.wait();

        if ( fileUniqueId ) {
            fileUniqueIdMutex = mutexSet.get( "get-file/" + fileUniqueId );

            if ( !fileUniqueIdMutex.tryLock() ) return fileIdMutex.wait();
        }

        var res;

        try {
            res = await this._request( "getFile", {
                "file_id": fileId,
            } );

            if ( !res.ok ) throw res;

            if ( !fileUniqueIdMutex ) {

                // XXX
                // fileUniqueIdMutex = mutexSet.get( "get-file/" + fileUniqueId );
                // if ( !fileIdMutex.tryLock() ) {
                //     res = await fileIdMutex.wait();
                // }
            }

            const tmp = await this.#downloadFile( res.data.file_path, res.data.file_unique_id );

            if ( !tmp.ok ) throw tmp;

            res.data.file = tmp.data;
        }
        catch ( e ) {
            res = result.catch( e, { "silent": true, "keepError": true } );
        }

        fileIdMutex.unlock( res );
        fileUniqueIdMutex?.unlock( res );

        return res;
    }

    // https://core.telegram.org/bots/api#answercallbackquery
    async answerCallbackQuery ( data ) {
        return this._request( "answerCallbackQuery", data );
    }

    // https://core.telegram.org/bots/api#getuserprofilephotos
    async getUserProfilePhotos ( data ) {
        return this._request( "getUserProfilePhotos", data );
    }

    // protected
    async _request ( method, body, signal ) {
        const headers = {};

        if ( !( body instanceof FormData ) ) {
            headers["content-type"] = "application/json";

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

            if ( data === undefined ) return result( [500, `Telegram connection error`] );

            if ( !data.ok ) return result( [res.status, data.description] );

            return result( 200, data.result );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    async #downloadFile ( path, fileUniqueId ) {
        const mutex = this.#mutexSet.get( "download-file/" + fileUniqueId );

        if ( !mutex.tryLock() ) return mutex.wait();

        var res;

        try {
            res = await fetch( `https://api.telegram.org/file/bot${this.#apiKey}/${path}` );

            if ( !res.ok ) throw res;

            const tmp = await res.tmpFile();

            res = result( 200, tmp );
        }
        catch ( e ) {
            res = result.catch( e, { "silent": true, "keepError": true } );
        }

        mutex.unlock( res );

        return res;
    }
}
