import fetch from "#lib/fetch";
import File from "#lib/file";
import FormData from "#lib/form-data";

export default class TelegramBotApi {
    #apiKey;

    constructor ( apiKey ) {
        this.#apiKey = apiKey;
    }

    // properties
    set apiKey ( apiKey ) {
        this.#apiKey = apiKey;
    }

    // public
    async getUpdates ( { offset, limit, timeout, allowedUpdates } = {} ) {
        const res = await this.#request( "getUpdates", {
            offset,
            "limit": limit || 100,
            "timeout": timeout || 0,
            "allowed_updates": allowedUpdates,
        } );

        if ( !res.ok ) return res;

        if ( res.data?.length ) {
            const updates = [];

            for ( const update of res.data ) {

                // const lastupdateid = update.update_id;
                // delete update.update_id;

                // if ( lastupdateid && lastupdateid >= this.#offset ) this.#offset = lastupdateid + 1;

                const type = Object.keys( update )[0];

                update[type].type = type;

                updates.push( update[type] );
            }

            res.data = updates;
        }

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
    async #request ( method, body ) {
        const headers = {};

        if ( !( body instanceof FormData ) ) {
            headers["Content-Type"] = "application/json";

            body = JSON.stringify( body );
        }

        const res = await fetch( `https://api.telegram.org/bot${this.#apiKey}/${method}`, {
            "method": "post",
            headers,
            body,
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
