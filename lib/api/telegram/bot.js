import Events from "#lib/events";
import fetch from "#lib/fetch";
import File from "#lib/file";
import FormData from "#lib/form-data";

export default class TelegramBot extends Events {
    #apiKey;
    #pollingTimeout = 180;
    #offset = 0;
    #isStarted;
    #abortController;
    #profile;

    constructor ( apiKey ) {
        super();

        this.#apiKey = apiKey;
    }

    // properties
    set apiKey ( apiKey ) {
        this.#apiKey = apiKey;
    }

    get isStarted () {
        return this.#isStarted;
    }

    // public
    async start () {
        if ( this.#isStarted ) return;

        this.#isStarted = true;
        this.#abortController = new AbortController();

        while ( 1 ) {
            await this.getUpdates( { "timeout": this.#pollingTimeout, "silent": false, "signal": this.#abortController.signal } );

            if ( !this.#isStarted ) break;
        }
    }

    stop () {
        if ( !this.#isStarted ) return;

        this.#isStarted = false;
        this.#abortController.abort();
        this.#abortController = null;
    }

    async getUpdates ( { limit, timeout, allowedUpdates, silent = true, signal } = {} ) {
        const res = await this.#request(
            "getUpdates",
            {
                "offset": this.#offset,
                "limit": limit || 100,
                "timeout": timeout || 0,
                "allowed_updates": allowedUpdates,
            },
            signal
        );

        if ( !res.ok ) return res;

        if ( res.data?.length ) {
            const updates = [];

            for ( const update of res.data ) {
                const lastupdateid = update.update_id;
                delete update.update_id;

                if ( lastupdateid && lastupdateid >= this.#offset ) this.#offset = lastupdateid + 1;

                const type = Object.keys( update )[0];

                update[type].type = type;

                updates.push( update[type] );
            }

            res.data = updates;

            // emit events
            if ( !silent ) for ( const update of updates ) this.emit( "update", update );
        }

        return res;
    }

    async getProfile () {
        if ( this.#profile ) return this.#profile;

        const res = this.#request( "getMe" );

        if ( res.ok ) this.#profile = res;

        return res;
    }

    async sendMessage ( chatId, text ) {
        return this.#request( "sendMessage", {
            "chat_id": chatId,
            text,
        } );
    }

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
            headers,
            body,
            signal,
        } );

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
            else {
                formData.append( name, typeof value === "object" ? JSON.stringify( value ) : value );
            }
        }

        return formData;
    }
}
