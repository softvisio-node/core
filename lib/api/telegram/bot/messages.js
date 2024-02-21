import File from "#lib/file";
import FormData from "#lib/form-data";

export default Super =>
    class extends ( Super || class {} ) {

        // public
        // https://core.telegram.org/bots/api#sendmessage
        async sendMessage ( data ) {
            return this._request( "sendMessage", data );
        }

        // https://core.telegram.org/bots/api#forwardmessage
        async forwardMessage ( data ) {
            return this._request( "forwardMessage", data );
        }

        // https://core.telegram.org/bots/api#copymessage
        async copyMessage ( data ) {
            return this._request( "copyMessage", data );
        }

        // https://core.telegram.org/bots/api#sendphoto
        async sendPhoto ( data ) {
            if ( data.photo instanceof File ) data = this.#createFormData( data );

            return this._request( "sendPhoto", data );
        }

        // https://core.telegram.org/bots/api#sendaudio
        async sendAudio ( data ) {
            if ( data.audio instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );

            return this._request( "sendAudio", data );
        }

        // https://core.telegram.org/bots/api#senddocument
        async sendDocument ( data ) {
            if ( data.document instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );

            return this._request( "sendDocument", data );
        }

        // https://core.telegram.org/bots/api#sendvideo
        async sendVideo ( data ) {
            if ( data.video instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );

            return this._request( "sendVideo", data );
        }

        // https://core.telegram.org/bots/api#sendanimation
        async sendAnimation ( data ) {
            if ( data.animation instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );

            return this._request( "sendAnimation", data );
        }

        // https://core.telegram.org/bots/api#sendvoice
        async sendVoice ( data ) {
            if ( data.voice instanceof File ) data = this.#createFormData( data );

            return this._request( "sendVoice", data );
        }

        // https://core.telegram.org/bots/api#sendvideonote
        async sendVideoNote ( data ) {
            return this._request( "sendVideoNote", data );
        }

        // https://core.telegram.org/bots/api#sendmediagroup
        async sendMediaGroup ( data ) {
            data = { ...data };

            let formData,
                id = 0;

            const media = [];

            for ( let item of data.media ) {
                if ( item.media instanceof File || item.thumbnail instanceof File ) {
                    formData = true;

                    item = { ...item };

                    // media
                    if ( item.media instanceof File ) {
                        const name = "media-" + id++;

                        data[ name ] = item.media;

                        item.media = "attach://" + name;
                    }

                    // thumbnail
                    if ( item.thumbnail instanceof File ) {
                        const name = "media-" + id++;

                        data[ name ] = item.thumbnail;

                        item.thumbnail = "attach://" + name;
                    }
                }

                media.push( item );
            }

            data.media = media;

            if ( formData ) data = this.#createFormData( data );

            return this._request( "sendMediaGroup", data );
        }

        // https://core.telegram.org/bots/api#sendvenue
        async sendVenue ( data ) {
            return this._request( "sendVenue", data );
        }

        // https://core.telegram.org/bots/api#sendcontact
        async sendContact ( data ) {
            return this._request( "sendContact", data );
        }

        // https://core.telegram.org/bots/api#senddice
        async sendDice ( data ) {
            return this._request( "sendDice", data );
        }

        // https://core.telegram.org/bots/api#editmessagetext
        async editMessageText ( data ) {
            return this._request( "editMessageText", data );
        }

        // https://core.telegram.org/bots/api#editmessagecaption
        async editMessageCaption ( data ) {
            return this._request( "editMessageCaption", data );
        }

        // https://core.telegram.org/bots/api#editmessagemedia
        async editMessageMedia ( data ) {
            return this._request( "editMessageMedia", data );
        }

        // https://core.telegram.org/bots/api#editmessagereplymarkup
        async editMessageReplyMarkup ( data ) {
            return this._request( "editMessageReplyMarkup", data );
        }

        // https://core.telegram.org/bots/api#deletemessage
        async deleteMessage ( data ) {
            return this._request( "deleteMessage", data );
        }

        // oritected
        #createFormData ( data ) {
            const formData = new FormData();

            for ( const [ name, value ] of Object.entries( data ) ) {
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
