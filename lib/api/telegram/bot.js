import Events from "#lib/events";
import fetch from "#lib/fetch";

export default class TelegramBot extends Events {
    #key;
    #pollingTimeout = 180;
    #offset = 0;
    #pollingStarted;
    #pollingAbortController;
    #profile;

    constructor ( key ) {
        super();

        this.#key = key;
    }

    // public
    async startPolling () {
        if ( this.#pollingStarted ) return;

        this.#pollingStarted = true;
        this.#pollingAbortController = new AbortController();

        while ( 1 ) {
            await this.getUpdates( { "timeout": this.#pollingTimeout, "silent": false, "signal": this.#pollingAbortController.signal } );

            if ( !this.#pollingStarted ) break;
        }
    }

    stopPolling () {
        if ( !this.#pollingStarted ) return;

        this.#pollingStarted = false;
        this.#pollingAbortController.abort();
        this.#pollingAbortController = null;
    }

    async getUpdates ( { limit, timeout, allowedUpdates, silent = true, signal } = {} ) {
        const res = await this.#request( "getUpdates",
            {
                "offset": this.#offset,
                "limit": limit || 100,
                "timeout": timeout || 0,
                "allowed_updates": allowedUpdates,
            },
            signal );

        if ( !res.ok ) return res;

        if ( res.data?.length ) {
            const lastUpdateId = res.data.at( -1 ).update_id;

            if ( lastUpdateId && lastUpdateId >= this.#offset ) this.#offset = lastUpdateId + 1;

            // emit events
            if ( !silent ) for ( const update of res.data ) this.emit( "update", update );
        }

        return res;
    }

    async getProfile () {
        if ( this.#profile ) return this.#profile;

        const res = this.#request( "getMe" );

        if ( res.ok ) this.#profile = res;

        return res;
    }

    async sendMessage ( chatId, body, { replyMarkup } = {} ) {
        return this.#request( "sendMessage", {
            "chat_id": chatId,
            "text": body,
            "reply_markup": replyMarkup,
        } );
    }

    // private
    async #request ( method, payload, signal ) {
        const res = await fetch( `https://api.telegram.org/bot${this.#key}/${method}`, {
            "method": "post",
            "headers": {
                "Content-Type": "application/json",
            },
            "body": JSON.stringify( payload ),
            signal,
        } );

        if ( !res.ok ) return result( res );

        try {
            const data = await res.json();

            if ( !data.ok ) return result( [500, data.description] );

            return result( 200, data.result );
        }
        catch ( e ) {
            return result( 500 );
        }
    }
}
