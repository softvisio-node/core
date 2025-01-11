import path from "node:path";
import fetch from "#lib/fetch";
import FormData from "#lib/form-data";
import mime from "#lib/mime";
import mixins from "#lib/mixins";
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
    DEFAULT_UPDATES_TIMEOUT = 0;

export default class TelegramBotApi extends mixins( Chats, Forums, Games, InlineQuery, Location, Me, Messages, Payments, Polls, Stickers, TelegramPassport, WebApps, WebHooks ) {
    #apiToken;
    #mutexSet = new Mutex.Set();
    #dispatcher;
    #longDispatcher;

    constructor ( apiToken ) {
        super();

        this.#apiToken = apiToken;
    }

    // properties
    get apiToken () {
        return this.#apiToken;
    }

    set apiToken ( value ) {
        this.#apiToken = value;
    }

    // public
    async send ( method, data ) {
        return this[ method ]( data );
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
            signal,
            false
        );
    }

    // https://core.telegram.org/bots/api#getfile
    async getFile ( fileId, { stream } = {} ) {
        var res;

        if ( stream ) {
            res = await this._request( "getFile", {
                "file_id": fileId,
            } );

            if ( !res.ok ) return res;

            const res1 = await fetch( `https://api.telegram.org/file/bot${ this.#apiToken }/${ res.data.file_path }` );

            if ( !res1.ok ) return res1;

            res.data.stream = res1.body;

            return res;
        }
        else {
            const fileIdMutex = this.#mutexSet.get( "get-file/" + fileId );

            if ( !fileIdMutex.tryLock() ) return fileIdMutex.wait();

            try {
                res = await this._request( "getFile", {
                    "file_id": fileId,
                } );

                if ( !res.ok ) throw res;

                const tmp = await this.#downloadFile( res.data.file_path, res.data.file_unique_id );

                if ( !tmp.ok ) throw tmp;

                res.data.file = tmp.data;

                res.data.file.name = path.basename( res.data.file_path );
            }
            catch ( e ) {
                res = result.catch( e );
            }

            fileIdMutex.unlock( res );

            return res;
        }
    }

    async downloadFile ( req, fileId, cacheControl ) {
        const res = await this.getFile( fileId, { "stream": true } );

        if ( !res.ok ) return req.end( 404 );

        return req.end( {
            "status": 200,
            "headers": {
                "content-length": res.data.file_size,
                "content-type":
                    mime.findSync( {
                        "filename": res.data.file_path,
                    } )?.essence || "application/octet-stream",
                "cache-control": cacheControl,
            },
            "body": res.data.stream,
        } );
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
    async _request ( method, body, signal, bodyTimeout = true ) {
        const headers = {};

        if ( !( body instanceof FormData ) ) {
            headers[ "content-type" ] = "application/json";

            body = JSON.stringify( body );
        }

        const res = await fetch( `https://api.telegram.org/bot${ this.#apiToken }/${ method }`, {
            "method": "post",
            "dispatcher": this.#getDispatcher( bodyTimeout ),
            signal,
            headers,
            body,
        } );

        // aborted by abort signal
        if ( signal?.aborted ) return result( res );

        try {
            const data = await res.json();

            if ( data === undefined ) return result( [ 500, `Telegram connection error` ] );

            if ( !data.ok ) return result( [ res.status, data.description ] );

            return result( 200, data.result );
        }
        catch ( e ) {
            return result.catch( e );
        }
    }

    // private
    async #downloadFile ( path, fileUniqueId ) {
        const mutex = this.#mutexSet.get( "download-file/" + fileUniqueId );

        if ( !mutex.tryLock() ) return mutex.wait();

        var res;

        try {
            res = await fetch( `https://api.telegram.org/file/bot${ this.#apiToken }/${ path }` );

            if ( !res.ok ) throw res;

            const tmp = await res.tmpFile();

            res = result( 200, tmp );
        }
        catch ( e ) {
            res = result.catch( e );
        }

        mutex.unlock( res );

        return res;
    }

    #getDispatcher ( bodyTimeout = true ) {
        this.#dispatcher ??= new fetch.Dispatcher();

        this.#longDispatcher ??= new fetch.Dispatcher( {
            "bodyTimeout": 0,
        } );

        return bodyTimeout
            ? this.#dispatcher
            : this.#longDispatcher;
    }
}
