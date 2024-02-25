import TelegramChannel from "../channel.js";
import sql from "#lib/sql";
import LocaleTemplate from "#lib/locale/template";
import JsonContainer from "#lib/json-container";
import { mergeObjects } from "#lib/utils";

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

const SQL = {
    "setSubscribed": sql`UPDATE telegram_bot_user SET subscribed = ? WHERE id = ?`.prepare(),

    "setBanned": sql`UPDATE telegram_bot_user SET banned = ? WHERE id = ?`.prepare(),

    "setState": sql`UPDATE telegram_bot_user SET state = ? WHERE id = ?`.prepare(),

    "setLocale": sql`UPDATE telegram_bot_user SET locale = ? WHERE id = ?`.prepare(),
};

export default class TelegramBotChannel extends TelegramChannel {
    #bot;
    #id;
    #subscribed;
    #returned;
    #banned;
    #state;
    #stateJson;
    #locale;
    #userLocale;
    #avatarUrl;

    constructor ( bot, data ) {
        super( bot.telegram, data );

        this.#bot = bot;

        const fields = data.telegram_bot_user;

        this.#id = fields.id;

        this.updateTelegramBotUserFields( fields );
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get app () {
        return this.#bot.app;
    }

    get id () {
        return this.#id;
    }

    get telegramUserId () {
        return super.id;
    }

    get isSubscribed () {
        return this.#subscribed;
    }

    get isReturned () {
        return this.#returned;
    }

    get isBanned () {
        return this.#banned;
    }

    get state () {
        return this.#state;
    }

    get locale () {
        if ( !this.#locale ) {
            this.#locale = this.bot.locales.find( {
                "locale": this.#userLocale,
            } );
        }

        return this.#locale;
    }

    get localeIsSet () {
        return !!this.#userLocale;
    }

    get avatarUrl () {
        this.#avatarUrl ??= this.#bot.telegram.config.avatarUrl + this.#bot.id + "/" + this.#id;

        return this.#avatarUrl;
    }

    // public
    async init () {
        return result( 200 );
    }

    updateTelegramBotUserFields ( fields ) {
        if ( "subscribed" in fields ) this.#subscribed = fields.subscribed;

        if ( "returned" in fields ) this.#returned = fields.returned;

        if ( "banned" in fields ) this.#banned = fields.banned;

        if ( "state" in fields ) {
            if ( fields.state == null ) {
                fields.state = null;
                this.#stateJson = null;
            }
            else {
                try {
                    this.#state = JSON.parse( fields.state );
                    this.#stateJson = fields.state;
                }
                catch ( e ) {
                    fields.state = null;
                    this.#stateJson = null;
                }
            }
        }

        if ( "locale" in fields ) {
            if ( this.#userLocale !== fields.locale ) {
                this.#userLocale = fields.locale;

                this.#locale = null;
            }
        }
    }

    toJSON () {
        const data = super.toJSON();

        data.telegram_user_id = data.id;
        data.id = this.id;
        data.avatar_url = this.avatarUrl;

        return data;
    }

    async setSubscribed ( value ) {
        if ( value === this.#subscribed ) return result( 200 );

        const res = await this.dbh.do( SQL.setSubscribed, [ value, this.#id ] );

        if ( !res.ok ) return res;

        this.#subscribed = value;

        return result( 200 );
    }

    async setBanned ( value ) {
        if ( value === this.#banned ) return result( 200 );

        const res = await this.dbh.do( SQL.setBanned, [ value, this.#id ] );

        if ( !res.ok ) return res;

        this.#banned = value;

        return result( 200 );
    }

    async updateState ( state, { dbh } = {} ) {
        var stateJson;

        if ( state == null ) {
            stateJson = null;
        }
        else {
            state = mergeObjects( {}, this.#state, state );

            stateJson = JSON.stringify( state );
        }

        // not changed
        if ( stateJson === this.#stateJson ) return result( 200 );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setState, [ stateJson, this.#id ] );

        if ( !res.ok ) return res;

        this.#stateJson = stateJson;
        this.#state = state;

        return result( 200 );
    }

    async setLocale ( locale, { dbh } = {} ) {
        if ( locale === this.#userLocale ) return result( 200 );

        if ( !this.bot.locales.has( locale ) ) return result( [ 400, `Locale is not valid` ] );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setLocale, [ locale, this.#id ] );

        if ( !res.ok ) return res;

        this.#userLocale = locale;

        this.#locale = null;

        return result( 200 );
    }

    async send ( method, data ) {
        if ( !this.#subscribed || this.#banned ) return result( 200 );

        data = {
            ...data,
            "chat_id": this.telegramUserId,
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

        return this.bot.telegramBotApi.send( method, data );
    }

    async sendText ( text ) {
        return this.send( "sendMessage", {
            text,
        } );
    }

    async sendMessage ( data ) {
        return this.send( "sendMessage", data );
    }

    async sendChatAction ( action = "typing" ) {
        return this.send( "sendChatAction", {
            action,
        } );
    }

    async sendDeleteMessage ( messageId ) {
        return this.send( "deleteMessage", {
            "message_id": messageId,
        } );
    }

    async setChatCommands ( commands ) {
        if ( commands ) {
            return this.bot.telegramBotApi.setMyCommands( new JsonContainer(
                {
                    "scope": {
                        "type": "chat",
                        "chat_id": this.telegramUserId,
                    },
                    commands,
                },
                {
                    "translation": {
                        "localeDomain": this.locale,
                    },
                }
            ) );
        }
        else {
            return this.bot.telegramBotApi.deleteMyCommands( {
                "scope": {
                    "type": "chat",
                    "chat_id": this.telegramUserId,
                },
            } );
        }
    }

    async sendNotification ( subject, body ) {
        return this.send( "sendMessage", {
            "parse_mode": "HTML",
            "text": l10nt( locale => {
                const text = [];

                if ( subject ) {
                    text.push( "<b>" + LocaleTemplate.toString( subject, { locale } ) + "</b>" );
                }

                if ( body ) {
                    text.push( LocaleTemplate.toString( body, { locale } ) );
                }

                return text.join( "\n\n" );
            } ),
        } );
    }
}
