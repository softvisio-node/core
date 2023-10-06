import TelegramUser from "../user.js";
import { mergeObjects } from "#lib/utils";
import sql from "#lib/sql";
import JsonContainer from "#lib/json-container";
import path from "node:path";
import Mutex from "#lib/threads/mutex";
import Duration from "#lib/duration";

const SQL = {
    "setApiUserId": sql`UPDATE telegram_bot_user SET api_user_id = ? WHERE id = ?`.prepare(),

    "deleteApiUserId": sql`UPDATE telegram_bot_user SET api_user_id = NULL WHERE api_user_id = ? RETURNING telegram_user_id`.prepare(),

    "setSubscribed": sql`UPDATE telegram_bot_user SET subscribed = ? WHERE id = ?`.prepare(),

    "setBanned": sql`UPDATE telegram_bot_user SET banned = ? WHERE id = ?`.prepare(),

    "setState": sql`UPDATE telegram_bot_user SET state = ? WHERE id = ?`.prepare(),

    "updataAvatarUpdated": sql`UPDATE telegram_bot_user SET avatar_updated = CURRENT_TIMESTAMP WHERE id = ?`.prepare(),

    "updateAvatar": sql`
UPDATE
    telegram_bot_user
SET
    avatar_updated = CURRENT_TIMESTAMP,
    avatar_file_id = CASE
        WHEN EXISTS ( SELECT FROM telegram_bot_file WHERE id = avatar_file_id AND file_id = ? ) THEN avatar_file_id
        ELSE create_telegram_bot_file(
            _file_id => ?,
            _file_unique_id => ?,
            _filename => 'avatar.jpg',
            _content_type => 'image/jpg'
        )
    END
WHERE
    id = ?
RETURNING
    avatar_updated,
    avatar_file_id
`.prepare(),
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
    #localeIsSet = false;
    #botLocale;
    #apiUserLocale;
    #avatarFileId;
    #avatarUpdated;
    #mutexSet = new Mutex.Set();

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

    get isReturned () {
        return this.#returned;
    }

    get isBanned () {
        return this.#banned;
    }

    get module () {
        return ( this.#state.module ||= "/" );
    }

    get state () {
        this.#state.modules ||= {};

        return ( this.#state.modules[this.module] ||= {} );
    }

    get locale () {
        return this.#locale;
    }

    get avatarFileId () {
        return this.#avatarFileId;
    }

    get avatarUpdated () {
        return this.#avatarUpdated;
    }

    // public
    async runModule ( ctx, module, update ) {
        if ( !module.startsWith( "/" ) ) module = path.posix.join( this.module, module );

        var moduleInstance = this.#bot.getModuleInstance( module );

        // module not found
        if ( !moduleInstance ) {
            module = "/";

            moduleInstance = this.#bot.getModuleInstance( module );
        }

        // exit current module
        if ( module !== this.module ) {
            const moduleInstance = this.#bot.getModuleInstance( this.module );

            if ( moduleInstance ) {
                try {
                    await moduleInstance.exit( ctx );
                }
                catch ( e ) {
                    result.catch( e, { "keepError": true } );
                }
            }

            // switch module
            const res = await this.#setState( { module } );
            if ( !res.ok ) return res;
        }

        // run module
        try {
            return moduleInstance.run( ctx, update );
        }
        catch ( e ) {
            return result.catch( e, { "keepError": true } );
        }
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
            this.#state = fields.state || {
                "module": "/",
                "midules": {},
            };
        }

        if ( "locale" in fields ) {
            this.#botLocale = fields.locale;
            this.#defineLocale();
        }

        if ( "avatar_file_id" in fields ) {
            this.#avatarFileId = fields.avatar_file_id;
        }

        if ( "avatar_updated" in fields ) {
            this.#avatarUpdated = fields.avatar_updated ? new Date( fields.avatar_updated ) : null;
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
                this.app.l10nt( `Telegram account removed` ),
                this.app.locale.l10nt( `Your Telegram account removed from your user profile.` )
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
                this.app.locale.l10nt( `Telegram account linked` ),
                this.app.locale.l10nt( `Your Telegram account linked to your user profile.` )
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

    async setState ( state ) {
        return this.#setState( {
            "modules": {
                [this.module]: state,
            },
        } );
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

        return this.bot.telegramBotApi.send(
            method,
            new JsonContainer(
                {
                    ...data,
                    "chat_id": this.telegramId,
                },
                {
                    "translation": {
                        "domain": this.locale,
                    },
                }
            )
        );
    }

    async sendMessage ( text ) {
        return this.send( "sendMessage", {
            text,
        } );
    }

    async updateAvatar () {
        if ( this.avatarUpdated && Duration.new( this.bot.telegram.config.avatarRefreshInterval ).toDate( this.avatarUpdated ) >= new Date() ) return result( 200 );

        const mutex = this.#mutexSet.get( "avatar" );

        if ( !mutex.tryLock() ) return mutex.wait();

        var res;

        try {
            res = await this.bot.telegramBotApi.getUserProfilePhotos( {
                "user_id": this.telegramId,
                "offset": 0,
                "limit": 1,
            } );

            if ( !res.ok ) throw res;

            const photo = res.data.photos?.[0]?.[0];

            if ( !photo ) {
                res = await this.dbh.selectRow( SQL.updataAvatarUpdated, [this.botUserId] );

                if ( !res.ok ) throw res;

                this.#avatarUpdated = new Date( res.data.avatar_updated );

                throw result( 200 );
            }

            res = await this.dbh.selectRow( SQL.updateAvatar, [

                //
                photo,
                photo.file_id,
                photo.file_unique_id,
                this.botUserId,
            ] );
            if ( !res.ok ) throw res;

            this.#avatarUpdated = new Date( res.data.avatar_updated );
            this.#avatarFileId = res.data.avatar_file_id;
        }
        catch ( e ) {
            res = result.catch( e, { "silent": true, "keepError": true } );
        }

        mutex.unlock( res );

        return res;
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

    async #setState ( state ) {
        state = mergeObjects( {}, this.#state, state );

        const res = await this.dbh.do( SQL.setState, [state, this.#botUserId] );

        if ( !res.ok ) return res;

        this.#state = state;

        return result( 200 );
    }
}
