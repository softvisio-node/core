import TelegramUser from "../user.js";
import sql from "#lib/sql";
import Mutex from "#lib/threads/mutex";
import LocaleTranslation from "#lib/locale/translation";
import JsonContainer from "#lib/json-container";
import { mergeObjects } from "#lib/utils";

const mediaMethods = new Set( [

    //
    "sendPhoto",
    "sendAudio",
    "sendDocument",
    "sendVideo",
    "sendAnimation",
    "sendVoice",
    "sendMediaGroup",
] );

const SQL = {
    "setApiUserId": sql`UPDATE telegram_bot_user SET api_user_id = ? WHERE id = ?`.prepare(),

    "deleteApiUserId": sql`UPDATE telegram_bot_user SET api_user_id = NULL WHERE api_user_id = ? RETURNING telegram_user_id`.prepare(),

    "setSubscribed": sql`UPDATE telegram_bot_user SET subscribed = ? WHERE id = ?`.prepare(),

    "setBanned": sql`UPDATE telegram_bot_user SET banned = ? WHERE id = ?`.prepare(),

    "setState": sql`UPDATE telegram_bot_user SET state = ? WHERE id = ?`.prepare(),

    "setLocale": sql`UPDATE telegram_bot_user SET locale = ? WHERE id = ?`.prepare(),
};

export default class TelegramBotUser extends TelegramUser {
    #bot;
    #botUserId;
    #apiUserId;
    #subscribed;
    #returned;
    #banned;
    #state;
    #locale;
    #userLocale;
    #mutexSet = new Mutex.Set();
    #avatarUrl;

    constructor ( bot, fields ) {
        super( bot.dbh, fields );

        this.#bot = bot;

        this.#botUserId = fields.telegram_bot_user_id;

        this.updateBotUserFields( fields );
    }

    // properties
    get app () {
        return this.#bot.app;
    }

    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    get botUserId () {
        return this.#botUserId;
    }

    get apiUserId () {
        return this.#apiUserId;
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
        this.#avatarUrl ??= this.app.telegram.config.avatarUrl + this.bot.id + "/" + this.botUserId;

        return this.#avatarUrl;
    }

    // public
    toJSON () {
        return {
            "id": this.botUserId,
            "username": this.username,
            "avatar_url": this.avatarUrl,
        };
    }

    updateBotUserFields ( fields ) {
        if ( "api_user_id" in fields ) {
            const oldValue = this.#apiUserId;

            if ( oldValue !== fields.api_user_id ) {
                this.#apiUserId = fields.api_user_id;

                this.emit( "apiUserIdUpdate", this, fields.api_user_id, oldValue );
            }
        }

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

    async setApiUserId ( apiUserId, { dbh } = {} ) {
        apiUserId ||= null;

        if ( this.#apiUserId === apiUserId ) return result( 200 );

        dbh ||= this.dbh;

        const res = await dbh.begin( async dbh => {
            let res;

            // unlink
            if ( !apiUserId ) {
                const apiUser = await this.app.users.getUserById( this.apiUserId, { dbh } );
                if ( !apiUser ) throw result( [404, `API user not founs`] );

                res = await dbh.do( SQL.setApiUserId, [null, this.#botUserId] );
                if ( !res.ok ) throw res;

                dbh.doAfterCommit( () => {
                    this.updateBotUserFields( { "api_user_id": null } );

                    this.app.publishToApi( "/notifications/telegram/update/", apiUser.id );

                    this.app.notifications.sendNotification(
                        "security",
                        apiUser.id,
                        this.app.templates.get( "telegram/unlink-account/subject" ),
                        this.app.templates.get( "telegram/unlink-account/body" ).clone( {
                            "data": {
                                "telegramUsername": this.username,
                                "email": apiUser.email,
                            },
                        } )
                    );
                } );
            }

            // link
            else {
                const apiUser = await this.app.users.getUserById( apiUserId, { dbh } );
                if ( !apiUser ) throw result( [404, `API user not founs`] );

                // unlink old user
                if ( this.apiUserId ) {
                    res = await this.setApiUserId( null, { dbh } );
                    if ( !res.ok ) throw res;
                }

                // unlink old bot
                const oldBot = await this.bot.users.getByApiUserId( apiUserId, { dbh } );
                if ( oldBot ) {
                    res = await oldBot.setApiUserId( null, { dbh } );
                    if ( !res.ok ) throw res;
                }

                res = await dbh.do( SQL.setApiUserId, [apiUserId, this.#botUserId] );
                if ( !res.ok ) throw res;

                // change locale
                if ( this.bot.locales.has( apiUser.locale ) ) {
                    res = await this.setLocale( apiUser.locale, { dbh } );
                    if ( !res.ok ) throw res;
                }

                dbh.doAfterCommit( () => {
                    this.updateBotUserFields( { "api_user_id": apiUserId } );

                    this.app.publishToApi( "/notifications/telegram/update/", apiUserId, this );

                    this.app.notifications.sendNotification(
                        "security",
                        apiUserId,
                        this.app.templates.get( "telegram/link-account/subject" ),
                        this.app.templates.get( "telegram/link-account/body" ).clone( {
                            "data": {
                                "telegramUsername": this.username,
                                "email": apiUser.email,
                            },
                        } )
                    );
                } );
            }

            return result( 200 );
        } );

        return res;
    }

    async setSubscribed ( value ) {
        if ( value === this.#subscribed ) return result( 200 );

        const res = await this.dbh.do( SQL.setSubscribed, [value, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#subscribed = value;

        return result( 200 );
    }

    async setBanned ( value ) {
        if ( value === this.#banned ) return result( 200 );

        const res = await this.dbh.do( SQL.setBanned, [value, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#banned = value;

        return result( 200 );
    }

    async updateState ( state ) {
        if ( state ) state = mergeObjects( {}, this.state, state );

        const res = await this.dbh.do( SQL.setState, [state, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#state = state;

        return result( 200 );
    }

    async setLocale ( locale, { dbh } = {} ) {
        if ( locale === this.#userLocale ) return result( 200 );

        if ( !this.bot.locales.has( locale ) ) return result( [400, `Locale is not valid`] );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setLocale, [locale, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#userLocale = locale;

        this.#locale = null;

        return result( 200 );
    }

    async send ( method, data ) {
        if ( !this.#subscribed || this.#banned ) return result( 200 );

        data = {
            ...data,
            "chat_id": this.telegramId,
        };

        if ( mediaMethods.has( method ) ) {
            if ( data.caption ) data.caption = LocaleTranslation.toString( data.caption, { "localeDomain": this.locale } );
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

    async sendChatAction ( action = "typing" ) {
        return this.send( "sendChatAction", {
            action,
        } );
    }

    async setChatCommands ( commands ) {
        if ( commands ) {
            return this.bot.telegramBotApi.setMyCommands( new JsonContainer(
                {
                    "scope": {
                        "type": "chat",
                        "chat_id": this.telegramId,
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
                    "chat_id": this.telegramId,
                },
            } );
        }
    }

    async deleteMessage ( messageId ) {
        return this.send( "deleteMessage", {
            "message_id": messageId,
        } );
    }
}
