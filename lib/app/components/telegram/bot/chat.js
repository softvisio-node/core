import LocaleTemplate from "#lib/locale/template";
import JsonContainer from "#lib/json-container";

const mediaMethods = new Set( [

    //
    "sendChatAction",
    "sendPhoto",
    "sendAudio",
    "sendDocument",
    "sendVideo",
    "sendAnimation",
    "sendVoice",
    "sendMediaGroup",
] );

export default Super =>
    class extends Super {
        #bot;
        #avatarUrl;

        constructor ( bot, data ) {
            super( bot.telegram, data );

            this.#bot = bot;
        }

        // properties
        get bot () {
            return this.#bot;
        }

        get avatarUrl () {
            this.#avatarUrl ??= this.#bot.telegram.config.avatarUrl + this.#bot.id + "/" + this.id;

            return this.#avatarUrl;
        }

        get locale () {
            return this.bot.defaultLocale;
        }

        get canSend () {
            return true;
        }

        // public
        toJSON () {
            const json = super.toJSON();

            json.avatar_url = this.avatarUrl;

            return json;
        }

        async send ( method, data ) {
            if ( !this.canSend ) return result( 200 );

            data = {
                ...data,
                "chat_id": this.id,
            };

            if ( mediaMethods.has( method ) ) {
                if ( data.caption ) {
                    data.caption = LocaleTemplate.toString( data.caption, {
                        "localeDomain": this.locale,
                    } );
                }

                if ( data.reply_markup ) {
                    data.reply_markup = new JsonContainer( data.reply_markup, {
                        "translation": {
                            "localeDomain": this.locale,
                        },
                    } );
                }
            }
            else if ( method === "sendMediaGroup" ) {
                const media = [];

                for ( let item of data.media ) {
                    if ( media.caption || media.title ) {
                        item = { ...item };

                        if ( media.caption ) {
                            media.caption = LocaleTemplate.toString( media.caption, {
                                "localeDomain": this.locale,
                            } );
                        }

                        if ( media.title ) {
                            media.title = LocaleTemplate.toString( media.title, {
                                "localeDomain": this.locale,
                            } );
                        }
                    }

                    media.push( item );
                }

                data.media = media;
            }
            else {
                data = new JsonContainer( data, {
                    "translation": {
                        "localeDomain": this.locale,
                    },
                } );
            }

            return this.#bot.api.send( method, data );
        }

        async sendText ( text ) {
            return this.send( "sendMessage", {
                text,
            } );
        }

        async sendMessage ( data ) {
            return this.send( "sendMessage", data );
        }

        async sendDeleteMessage ( messageId ) {
            return this.send( "deleteMessage", {
                "message_id": messageId,
            } );
        }
    };
