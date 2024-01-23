import TelegramUser from "../user.js";
import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";
import LocaleTranslation from "#lib/locale/translation";
import JsonContainer from "#lib/json-container";
import { mergeObjects } from "#lib/utils";
import Translation from "#lib/locale/translation";

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

export default class TelegramBotUser extends TelegramUser {
    #bot;
    #id;
    #subscribed;
    #returned;
    #banned;
    #state;
    #locale;
    #userLocale;
    #mutexSet = new Mutex.Set();
    #avatarUrl;

    constructor ( bot, fields ) {
        super( bot.telegram, {
            "id": fields.telegram_user_id,
            "api_user_id": fields.api_user_id,
            "is_bot": fields.is_bot,
            "username": fields.username,
            "first_name": fields.first_name,
            "last_name": fields.last_name,
            "phone": fields.phone,
        } );

        this.#bot = bot;

        this.#id = fields.id;

        this.updateTelegramBotUserFields( fields );
    }

    // properties
    get bot () {
        return this.#bot;
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
        return this.#state || {};
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
    toJSON () {
        const data = super.toJSON();

        data.telegram_user_id = data.id;
        data.id = this.id;
        data.avatar_url = this.avatarUrl;

        return data;
    }

    updateTelegramBotUserFields ( fields ) {
        if ( "subscribed" in fields ) this.#subscribed = fields.subscribed;

        if ( "returned" in fields ) this.#returned = fields.returned;

        if ( "banned" in fields ) this.#banned = fields.banned;

        if ( "state" in fields ) {
            this.#state = fields.state || {};
        }

        if ( "locale" in fields ) {
            if ( this.#userLocale !== fields.locale ) {
                this.#userLocale = fields.locale;

                this.#locale = null;
            }
        }
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

    async updateState ( state ) {
        if ( state ) state = mergeObjects( {}, this.state, state );

        const res = await this.dbh.do( SQL.setState, [ state, this.#id ] );

        if ( !res.ok ) return res;

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
                data.caption = LocaleTranslation.toString( data.caption, {
                    "localeDomain": this.locale,
                } );
            }
        }
        else if ( method === "sendMediaGroup" ) {
            const media = [];

            for ( let item of data.media ) {
                if ( media.caption || media.title ) {
                    item = { ...item };

                    if ( media.caption ) {
                        media.caption = LocaleTranslation.toString( media.caption, {
                            "localeDomain": this.locale,
                        } );
                    }

                    if ( media.title ) {
                        media.title = LocaleTranslation.toString( media.title, {
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
            "text": this.app.locale.l10nt( locale => {
                const text = [];

                if ( subject ) {
                    text.push( "<b>" + Translation.toString( subject, { locale } ) + "</b>" );
                }

                if ( body ) {
                    text.push( Translation.toString( body, { locale } ) );
                }

                return text.join( "\n\n" );
            } ),
        } );
    }
}
