import TelegramUser from "../user.js";
import sql from "#lib/sql";
import L10nt from "#lib/locale/l10nt";
import JsonContainer from "#lib/json-container";
import { mergeObjects } from "#lib/utils";
import Permissions from "#lib/app/user/permissions";
import Chat from "./chat.js";

const SQL = {
    "setApiUserId": sql`
UPDATE
    telegram_bot_user
SET
    api_user_id = ?
WHERE
    telegram_bot_id = ?
    AND telegram_user_id = ?
`.prepare(),

    "setSubscribed": sql`UPDATE telegram_bot_user SET subscribed = ? WHERE telegram_bot_id = ? AND telegram_user_id = ?`.prepare(),

    "setBanned": sql`UPDATE telegram_bot_user SET banned = ? WHERE telegram_bot_id = ? AND telegram_user_id = ?`.prepare(),

    "setState": sql`UPDATE telegram_bot_user SET state = ? WHERE telegram_bot_id = ? AND telegram_user_id = ?`.prepare(),

    "setLocale": sql`UPDATE telegram_bot_user SET locale = ? WHERE telegram_bot_id = ? AND telegram_user_id = ?`.prepare(),
};

export default class TelegramBotUser extends Chat( TelegramUser ) {
    #apiUserId;
    #subscribed;
    #returned;
    #banned;
    #state;
    #stateJson;
    #locale;
    #userLocale;

    constructor ( bot, data ) {
        super( bot, data );

        this.updateTelegramBotUserFields( data.telegram_bot_user );
    }

    // properties
    get apiUserId () {
        return this.#apiUserId;
    }

    get canSend () {
        return this.isSubscribed && !this.isBanned;
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

    // public
    toJSON () {
        const json = super.toJSON();

        json.api_user_id = this.#apiUserId;

        return json;
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

        if ( "api_user_id" in fields ) {
            const oldValue = this.#apiUserId;

            if ( oldValue !== fields.api_user_id ) {
                this.#apiUserId = fields.api_user_id;

                this.emit( "apiUserIdUpdate", this, fields.api_user_id, oldValue );
            }
        }
    }

    async setSubscribed ( subscribed ) {
        if ( subscribed === this.#subscribed ) return result( 200 );

        const res = await this.dbh.do( SQL.setSubscribed, [ subscribed, this.bot.id, this.id ] );

        if ( !res.ok ) return res;

        this.#subscribed = subscribed;

        return result( 200 );
    }

    async setBanned ( value ) {
        if ( value === this.#banned ) return result( 200 );

        const res = await this.dbh.do( SQL.setBanned, [ value, this.bot.id, this.id ] );

        if ( !res.ok ) return res;

        this.#banned = value;

        return result( 200 );
    }

    async setApiUserId ( apiUserId, { dbh } = {} ) {
        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setApiUserId, [

            //
            apiUserId,
            this.bot.id,
            this.id,
        ] );

        if ( !res.ok ) return res;

        if ( res.meta.rows ) {
            this.updateTelegramBotUserFields( { "api_user_id": apiUserId || null } );

            return res;
        }
        else {
            return result( [ 500, `Unable to update api user id` ] );
        }
    }

    async getApiUser () {
        if ( !this.#apiUserId ) return null;

        return this.app.users.getUserById( this.#apiUserId );
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

        const res = await dbh.do( SQL.setState, [ stateJson, this.bot.id, this.id ] );

        if ( !res.ok ) return res;

        this.#stateJson = stateJson;
        this.#state = state;

        return result( 200 );
    }

    async setLocale ( locale, { dbh } = {} ) {
        if ( locale === this.#userLocale ) return result( 200 );

        if ( !this.bot.locales.has( locale ) ) return result( [ 400, `Locale is not valid` ] );

        dbh ||= this.dbh;

        const res = await dbh.do( SQL.setLocale, [ locale, this.bot.id, this.id ] );

        if ( !res.ok ) return res;

        this.#userLocale = locale;

        this.#locale = null;

        return result( 200 );
    }

    async setChatCommands ( commands ) {
        if ( commands ) {
            return this.bot.api.setMyCommands( new JsonContainer(
                {
                    "scope": {
                        "type": "chat",
                        "chat_id": this.id,
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
            return this.bot.api.deleteMyCommands( {
                "scope": {
                    "type": "chat",
                    "chat_id": this.id,
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
                    text.push( "<b>" + L10nt.toString( subject, { locale } ) + "</b>" );
                }

                if ( body ) {
                    text.push( L10nt.toString( body, { locale } ) );
                }

                return text.join( "\n\n" );
            } ),
        } );
    }

    async getPermissions () {

        // not authemticated
        if ( !this.apiUserId ) {
            return Permissions.guestsPermissions;
        }

        // user is root
        else if ( this.app.userIsRoot( this.apiUserId ) ) {
            return Permissions.rootPermissions;
        }
        else {
            const user = await this.getApiUser();

            // user is disabled
            if ( !user?.isEnabled ) return Permissions.guestsPermissions;

            const permissions = await this.app.acl.getAclUserFullPermissions( this.bot.aclId, this.apiUserId );

            return permissions || Permissions.guestsPermissions;
        }
    }

    async apiCall ( method, ...args ) {
        return this.#call( method, args, false );
    }

    apiVoidCall ( method, ...args ) {
        return this.#call( method, args, true );
    }

    // private
    async #call ( method, args, isVoid ) {
        if ( !this.app.api ) return result( [ 500, `API not available` ] );

        if ( typeof method === "object" ) {
            var signal;

            ( { method, "arguments": args, signal } = method );
        }

        if ( isVoid ) {
            this.app.api.voidCall( {
                method,
                "arguments": args,
                "telegramBotUser": this,
                signal,
            } );
        }
        else {
            return this.app.api.call( {
                method,
                "arguments": args,
                "telegramBotUser": this,
                signal,
            } );
        }
    }
}
