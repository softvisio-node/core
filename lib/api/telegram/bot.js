import Events from "#lib/events";
import fetch from "#lib/fetch";

export default class TelegramBot extends Events {
    #key;
    #pollingTimeout = 180;
    #offset = 0;
    #pollingStarted;
    #profile;

    constructor ( key ) {
        super();

        this.#key = key;
    }

    // public
    async startPolling () {
        if ( this.#pollingStarted ) return;

        this.#pollingStarted = true;

        while ( 1 ) {
            const res = await this.getUpdates( { "timeout": this.#pollingTimeout } );

            if ( res.data ) {
                for ( const message of res.data ) this.emit( "message", message );
            }

            if ( !this.#pollingStarted ) break;
        }
    }

    stopPolling () {
        this.#pollingStarted = false;
    }

    async getUpdates ( options = {} ) {
        const res = await this.#request( "getUpdates", {
            "offset": this.#offset,
            "limit": options.limit || 100,
            "timeout": options.timeout || 0,
        } );

        if ( !res.ok ) return res;

        if ( res.data?.length ) {
            const updateId = res.data.at( -1 ).update_id;
            if ( updateId != null && updateId >= this.#offset ) this.#offset = updateId + 1;
        }

        return res;
    }

    async getProfile () {
        if ( this.#profile ) return this.#profile;

        const res = this.#request( "getMe" );

        if ( res.ok ) this.#profile = res;

        return res;
    }

    async sendMessage ( chatId, body ) {
        return this.#request( "sendMessage", { "chat_id": chatId, "text": body } );
    }

    // private
    async #request ( method, payload ) {
        const res = await fetch( `https://api.telegram.org/bot${this.#key}/${method}`, {
            "method": "post",
            "headers": {
                "Content-Type": "application/json",
            },
            "body": JSON.stringify( payload ),
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
