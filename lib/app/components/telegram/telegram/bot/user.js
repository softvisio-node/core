import TelegramUser from "../user.js";
import sql from "#lib/sql";
import JsonContainer from "#lib/json-container";
import path from "node:path";

const SQL = {
    "setApiUserId": sql`UPDATE telegram_bot_user SET api_user_id = ? WHERE id = ?`.prepare(),

    "deleteApiUserId": sql`UPDATE telegram_bot_user SET api_user_id = NULL WHERE api_user_id = ? RETURNING telegram_user_id`.prepare(),

    "setSubscribed": sql`UPDATE telegram_bot_user SET subscribed = ? WHERE id = ?`.prepare(),

    "setBanned": sql`UPDATE telegram_bot_user SET banned = ? WHERE id = ?`.prepare(),

    "setState": sql`UPDATE telegram_bot_user SET state = ? WHERE id = ?`.prepare(),
};

export default class TelegramBotUser extends TelegramUser {
    #bot;
    #botUserId;
    #apiUserId;
    #subscribed;
    #banned;
    #state;
    #locale;
    #localeIsSet = false;
    #botLocale;
    #apiUserLocale;

    constructor ( bot, fields ) {
        super( bot.dbh, fields );

        this.#bot = bot;

        this.#botUserId = fields.telegram_bot_user_id;

        this.updateBotUserFields( fields );

        this.on( "languageCodeUpdate", this.#onLanguageCodeChange.bind( this ) );
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

    get isBanned () {
        return this.#banned;
    }

    get module () {
        return ( this.#state.module ||= "/" );
    }

    get state () {
        return ( this.#state[this.module] ||= {} );
    }

    get locale () {
        return this.#locale;
    }

    // public
    // XXX
    async goTo ( module ) {
        if ( !module.startsWith( "/" ) ) module = path.posix.join( this.module, module );

        this.#state.module = module;
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

        if ( "banned" in fields ) this.#banned = fields.banned;

        if ( "state" in fields ) this.#state = fields.state || {};

        if ( "locale" in fields ) {
            this.#botLocale = fields.locale;
            this.#defineLocale();
        }
    }

    async setApiUserId ( apiUserId ) {
        apiUserId ||= null;

        if ( this.#apiUserId === apiUserId ) return result( 200 );

        var res;

        // unlink
        if ( !apiUserId ) {
            const oldApiUserId = this.#apiUserId;

            res = await this.dbh.do( SQL.setApiUserId, [apiUserId, this.#botUserId] );
            if ( !res.ok ) return res;

            this.updateBotUserFields( { "api_user_id": apiUserId } );

            this.setApiUserLocale();

            await this.app.notifications.sendNotification(

                //
                "security",
                oldApiUserId,
                this.app.telegram.locale.l10nt( `Telegram account removed` ),
                this.app.telegram.locale.l10nt( `Your Telegram account removed from your user profile.` )
            );
        }

        // link
        else {
            const oldUser = await this.bot.users.getByApiUserId();

            // unlink old user
            if ( oldUser ) {
                res = await oldUser.setApiUserId();
                if ( !res ) return res;
            }

            res = await this.dbh.do( SQL.setApiUserId, [apiUserId, this.#botUserId] );
            if ( !res.ok ) return res;

            this.updateBotUserFields( { "api_user_id": apiUserId } );

            const apiUser = await this.app.users.getUserById( apiUserId );
            this.setApiUserLocale( apiUser.locale );

            this.app.publishToApi( "/notifications/telegram-linked/", apiUserId, this.username );

            await this.app.notifications.sendNotification(

                //
                "security",
                apiUserId,
                this.app.telegram.locale.l10nt( `Telegram account linked` ),
                this.app.telegram.locale.l10nt( `Your Telegram account linked to your user profile.` )
            );
        }

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

    // XXX
    async setState ( state ) {
        state ||= {};

        const res = await this.dbh.do( SQL.setState, [state, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#state = state;

        return result( 200 );
    }

    async setLocale ( locale ) {
        if ( locale === this.#botLocale ) return result( 200 );

        if ( !this.bot.locales.has( locale ) ) return result( [400, `Locale is not valid`] );

        const res = await this.dbh.do( SQL.setLocale, [locale, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#botLocale = locale;
        this.#defineLocale();

        return result( 200 );
    }

    setApiUserLocale ( locale ) {
        this.#apiUserLocale = locale;

        this.#defineLocale();
    }

    async send ( method, data ) {
        if ( !this.#subscribed || this.#banned ) return result( 200 );

        return this.bot.telegramBotApi.send( method, {
            ...data,
            "chat_id": this.telegramId,
        } );
    }

    async sendMessage ( text ) {
        if ( !this.#subscribed || this.#banned ) return result( 200 );

        return this.bot.telegramBotApi.sendMessage( {
            "chat_id": this.telegramId,
            "text": new JsonContainer( text, {
                "localeTranslation": {
                    "domain": this.locale,
                },
            } ),
        } );
    }

    // private
    #defineLocale () {
        if ( this.#botLocale && this.bot.locales.has( this.#botLocale ) ) {
            this.#locale = this.#botLocale;

            this.#localeIsSet = true;
        }
        else if ( this.#apiUserLocale && this.bot.locales.has( this.#apiUserLocale ) ) {
            this.#locale = this.#apiUserLocale;

            this.#localeIsSet = true;
        }
        else {
            this.#localeIsSet = false;

            this.#onLanguageCodeChange();
        }
    }

    #onLanguageCodeChange () {
        if ( this.#localeIsSet ) return;

        this.#locale = this.bot.locales.find( { "language": this.languageCode } );
    }

    // XXX
    async #setState ( state ) {
        const res = await this.dbh.do( SQL.setState, [state, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#state = state;

        return result( 200 );
    }
}
