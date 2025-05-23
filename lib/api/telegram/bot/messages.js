import File from "#lib/file";
import FileStream from "#lib/file-stream";
import FormData from "#lib/form-data";
import uuid from "#lib/uuid";

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
            return this._doRequest( "sendPhoto", this.#createRequestBody( data ) );
        }

        // https://core.telegram.org/bots/api#sendaudio
        async sendAudio ( data ) {
            return this._doRequest( "sendAudio", this.#createRequestBody( data ) );
        }

        // https://core.telegram.org/bots/api#senddocument
        async sendDocument ( data ) {
            return this._doRequest( "sendDocument", this.#createRequestBody( data ) );
        }

        // https://core.telegram.org/bots/api#sendvideo
        async sendVideo ( data ) {
            return this._doRequest( "sendVideo", this.#createRequestBody( data ) );
        }

        // https://core.telegram.org/bots/api#sendanimation
        async sendAnimation ( data ) {
            return this._doRequest( "sendAnimation", this.#createRequestBody( data ) );
        }

        // https://core.telegram.org/bots/api#sendvoice
        async sendVoice ( data ) {
            if ( data.voice instanceof File ) data = this.#createRequestBody( data );

            return this._doRequest( "sendVoice", data );
        }

        // https://core.telegram.org/bots/api#sendvideonote
        async sendVideoNote ( data ) {
            return this._doRequest( "sendVideoNote", data );
        }

        // https://core.telegram.org/bots/api#sendmediagroup
        async sendMediaGroup ( data ) {
            return this._doRequest( "sendMediaGroup", this.#createRequestBody( data ) );
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

        // private
        #createRequestBody ( data ) {
            const files = new Map(),
                json = JSON.stringify( data, function ( key, value ) {
                    if ( value instanceof File || value instanceof FileStream ) {
                        const id = uuid();

                        files.set( id, value );

                        value = "attach://" + id;
                    }

                    return value;
                } );

            if ( files.size ) {
                const formData = new FormData();

                for ( const [ key, value ] of Object.entries( JSON.parse( json ) ) ) {
                    if ( typeof value === "string" ) {
                        formData.append( key, value );
                    }
                    else {
                        formData.append( key, JSON.stringify( value ) );
                    }
                }

                for ( const [ name, value ] of files.entries() ) {
                    formData.append( name, value );
                }

                return formData;
            }
            else {
                return json;
            }
        }
    };
