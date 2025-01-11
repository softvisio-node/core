import File from "#lib/file";
import FormData from "#lib/form-data";

export default Super =>
    class extends ( Super || class {} ) {

        // public
        // https://core.telegram.org/bots/api#sendmessage
        async sendMessage ( data ) {
            return this._doRequest( "sendMessage", data );
        }

        // https://core.telegram.org/bots/api#forwardmessage
        async forwardMessage ( data ) {
            return this._doRequest( "forwardMessage", data );
        }

        // https://core.telegram.org/bots/api#forwardmessages
        async forwardMessages ( data ) {
            return this._doRequest( "forwardMessages", data );
        }

        // https://core.telegram.org/bots/api#copymessage
        async copyMessage ( data ) {
            return this._doRequest( "copyMessage", data );
        }

        // https://core.telegram.org/bots/api#copymessages
        async copyMessages ( data ) {
            return this._doRequest( "copyMessages", data );
        }

        // https://core.telegram.org/bots/api#sendphoto
        async sendPhoto ( data ) {
            if ( data.photo instanceof File ) data = this.#createFormData( data );

            return this._doRequest( "sendPhoto", data );
        }

        // https://core.telegram.org/bots/api#sendaudio
        async sendAudio ( data ) {
            if ( data.audio instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );

            return this._doRequest( "sendAudio", data );
        }

        // https://core.telegram.org/bots/api#senddocument
        async sendDocument ( data ) {
            if ( data.document instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );

            return this._doRequest( "sendDocument", data );
        }

        // https://core.telegram.org/bots/api#sendvideo
        async sendVideo ( data ) {
            if ( data.video instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );

            return this._doRequest( "sendVideo", data );
        }

        // https://core.telegram.org/bots/api#sendanimation
        async sendAnimation ( data ) {
            if ( data.animation instanceof File || data.thumb instanceof File ) data = this.#createFormData( data );

            return this._doRequest( "sendAnimation", data );
        }

        // https://core.telegram.org/bots/api#sendvoice
        async sendVoice ( data ) {
            if ( data.voice instanceof File ) data = this.#createFormData( data );

            return this._doRequest( "sendVoice", data );
        }

        // https://core.telegram.org/bots/api#sendvideonote
        async sendVideoNote ( data ) {
            return this._doRequest( "sendVideoNote", data );
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

            return this._doRequest( "sendMediaGroup", data );
        }

        // https://core.telegram.org/bots/api#sendvenue
        async sendVenue ( data ) {
            return this._doRequest( "sendVenue", data );
        }

        // https://core.telegram.org/bots/api#sendcontact
        async sendContact ( data ) {
            return this._doRequest( "sendContact", data );
        }

        // https://core.telegram.org/bots/api#senddice
        async sendDice ( data ) {
            return this._doRequest( "sendDice", data );
        }

        // https://core.telegram.org/bots/api#editmessagetext
        async editMessageText ( data ) {
            return this._doRequest( "editMessageText", data );
        }

        // https://core.telegram.org/bots/api#editmessagecaption
        async editMessageCaption ( data ) {
            return this._doRequest( "editMessageCaption", data );
        }

        // https://core.telegram.org/bots/api#editmessagemedia
        async editMessageMedia ( data ) {
            return this._doRequest( "editMessageMedia", data );
        }

        // https://core.telegram.org/bots/api#editmessagereplymarkup
        async editMessageReplyMarkup ( data ) {
            return this._doRequest( "editMessageReplyMarkup", data );
        }

        // https://core.telegram.org/bots/api#deletemessage
        async deleteMessage ( data ) {
            return this._doRequest( "deleteMessage", data );
        }

        // https://core.telegram.org/bots/api#setmessagereaction
        async setMessageReaction ( data ) {
            return this._doRequest( "setMessageReaction", data );
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
