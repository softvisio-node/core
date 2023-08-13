import File from "#lib/file";
import FormData from "#lib/form-data";

export default Super =>
    class extends ( Super || Object ) {

        // public
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

            return this._request( method, data );
        }

        // XXX - ???, rename
        async sendMessage ( chatId, text ) {
            return this._request( "sendMessage", {
                "chat_id": chatId,
                text,
            } );
        }

        // XXX
        // https://core.telegram.org/bots/api#sendmessage
        async sendMessage1 () {}

        // https://core.telegram.org/bots/api#forwardmessage
        async forwardMessage () {}

        // https://core.telegram.org/bots/api#copymessage
        async copyMessage () {}

        // https://core.telegram.org/bots/api#sendphoto
        async sendPhoto () {}

        // https://core.telegram.org/bots/api#sendaudio
        async sendAudio () {}

        // https://core.telegram.org/bots/api#senddocument
        async sendDocument () {}

        // https://core.telegram.org/bots/api#sendvideo
        async sendVideo () {}

        // https://core.telegram.org/bots/api#sendanimation
        async sendAnimation () {}

        // https://core.telegram.org/bots/api#sendvoice
        async sendVoice () {}

        // https://core.telegram.org/bots/api#sendvideonote
        async sendVideoNote () {}

        // https://core.telegram.org/bots/api#sendmediagroup
        async sendMediaGroup () {}

        // https://core.telegram.org/bots/api#sendvenue
        async sendVenue () {}

        // https://core.telegram.org/bots/api#sendcontact
        async sendContact () {}

        // https://core.telegram.org/bots/api#senddice
        async sendDice () {}

        // https://core.telegram.org/bots/api#editmessagetext
        async editMessageText () {}

        // https://core.telegram.org/bots/api#editmessagecaption
        async editMessageCaption () {}

        // https://core.telegram.org/bots/api#editmessagemedia
        async editMessageMedia () {}

        // https://core.telegram.org/bots/api#editmessagereplymarkup
        async editMessageReplyMarkup () {}

        // https://core.telegram.org/bots/api#deletemessage
        async deleteMessage () {}

        // oritected
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
    };
