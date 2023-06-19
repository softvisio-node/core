import TelegramUser from "../user.js";
import sql from "#lib/sql";
import LocaleTranslation from "#lib/locale/translation";

const SQL = {
    "setApiUserId": sql`UPDATE telegram_bot_user SET api_user_id = ? WHERE id = ?`.prepare(),

    "deleteApiUserId": sql`UPDATE telegram_bot_user SET api_user_id = NULL WHERE api_user_id = ? RETURNING telegram_user_id`.prepare(),

    "setState": sql`UPDATE telegram_bot_user SET state = ? WHERE id = ?`.prepare(),
};

export default class TelegramBotUser extends TelegramUser {
    #bot;
    #dbh;
    #botUserId;
    #apiUserId;
    #subscribed;
    #disabled;
    #state;
    #locale;
    #localeIsSet = false;

    constructor ( bot, fields ) {
        super( bot.dbh, fields );

        this.#bot = bot;
        this.#dbh = bot.dbh;

        this.#botUserId = fields.telegram_bot_user_id;

        this.updateBotUserFields( fields );

        this.on( "languageCodeUpdate", this.#onLanguageCodeChange.bind( this ) );
    }

    // properties
    get bot () {
        return this.#bot;
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

    get isDisabled () {
        return this.#disabled;
    }

    get state () {
        return this.#state;
    }

    get locale () {
        return this.#locale;
    }

    // public
    updateBotUserFields ( fields ) {
        if ( "api_user_id" in fields ) {
            const oldValue = this.#apiUserId;

            if ( oldValue !== fields.api_user_id ) {
                this.#apiUserId = fields.api_user_id;

                this.emit( "apiUserIdUpdate", this, fields.api_user_id, oldValue );
            }
        }

        if ( "subscribed" in fields ) this.#subscribed = fields.subscribed;

        if ( "disabled" in fields ) this.#disabled = fields.disabled;

        if ( "state" in fields ) this.#state = fields.state || {};

        if ( "locale" in fields ) this.#setLocale( fields.locale );
    }

    async setApiUserId ( apiUserId ) {
        apiUserId ||= null;

        if ( this.#apiUserId === apiUserId ) return result( 200 );

        var res;

        // unlink
        if ( !apiUserId ) {
            const oldApiUserId = this.#apiUserId;

            res = await this.#dbh.do( SQL.setApiUserId, [apiUserId, this.#botUserId] );
            if ( !res.ok ) return res;

            this.updateBotUserFields( { "api_user_id": apiUserId } );

            this.#bot.app.notifications.sendNotification(

                //
                "security",
                oldApiUserId,
                this.#bot.locale.i18nt( `Telegram account removed` ),
                this.#bot.locale.i18nt( `Your Telegram removed from your user profile.` )
            );
        }

        // link
        else {
            const oldUser = await this.#bot.users.getByApiUserId();

            // unlink old user
            if ( oldUser ) {
                res = await oldUser.setApiUserId();
                if ( !res ) return res;
            }

            res = await this.#dbh.do( SQL.setApiUserId, [apiUserId, this.#botUserId] );
            if ( !res.ok ) return res;

            this.updateBotUserFields( { "api_user_id": apiUserId } );

            this.#bot.app.publishToApi( "/notifications/telegram-linked/", apiUserId, true );

            this.#bot.app.notifications.sendNotification(

                //
                "security",
                apiUserId,
                this.#bot.locale.i18nt( `Telegram account linked` ),
                this.#bot.locale.i18nt( `Your Telegram linked to your user profile.` )
            );
        }

        return res;
    }

    async setSubscribed ( value ) {
        if ( value === this.#subscribed ) return result( 200 );

        const res = await this.#dbh.do( SQL.setSubscribed, [value, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#subscribed = value;

        return result( 200 );
    }

    async setState ( state ) {
        state ||= {};

        const res = await this.#dbh.do( SQL.setState, [state, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#state = state;

        return result( 200 );
    }

    async setLocale ( locale ) {
        if ( locale === this.#locale ) return result( 200 );

        if ( !this.#bot.isLocaleValid( locale ) ) return result( [400, `Locale is not valid`] );

        const res = await this.#dbh.do( SQL.setLocale, [locale, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#setLocale( locale );

        return result( 200 );
    }

    async sendMessage ( text ) {
        if ( !this.#subscribed || this.#disabled ) return result( 200 );

        return this.#bot.telegramBotApi.sendMessage( this.telegramId, LocaleTranslation.translate( text, { "domain": this.locale } ) );
    }

    async send ( method, data ) {
        if ( !this.#subscribed || this.#disabled ) return result( 200 );

        return this.#bot.telegramBotApi.send( method, data );
    }

    // private
    #setLocale ( locale ) {
        this.#locale = locale;

        if ( this.#locale && this.#bot.isLocaleValid( this.#locale ) ) {
            this.#localeIsSet = true;
        }
        else {
            this.#localeIsSet = false;

            this.#onLanguageCodeChange();
        }
    }

    #onLanguageCodeChange () {
        if ( this.#localeIsSet ) return;

        this.#locale = this.#bot.defineLocale( this.languageCode );
    }
}
