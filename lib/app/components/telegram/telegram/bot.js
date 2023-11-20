import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import TelegramBotContext from "./bot/context.js";
import Mutex from "#lib/threads/mutex";
import TelegramBotUpdater from "./bot/updater.js";
import TelegramBotProcessor from "./bot/processor.js";
import TelegramBotUsers from "./bot/users.js";
import Locales from "#lib/locale/locales";
import { uuidFromBuffer } from "#lib/uuid";
import TelegramBotFiles from "./bot/files.js";
import crypto from "node:crypto";
import Modules from "./bot/modules.js";

const SQL = {
    "setApiToken": sql`UPDATE telegram_bot_api_token SET api_token = ? WHERE telegram_bot_id = ?`.prepare(),

    "setStarted": sql`UPDATE telegram_bot SET started = ?, error = ?, error_text = ? WHERE id = ?`.prepare(),

    "createTelegramUser": sql`INSERT INTO telegram_user ( id, is_bot, username, first_name, last_name ) VALUES ( ?, ?, ?, ?, ? ) ON CONFLICT ( telegram_id ) DO UPDATE SET username = EXCLUDED.username RETURNING id`.prepare(),

    "createTelegramBotUser": sql`
INSERT INTO
    telegram_bot_user
(
    telegram_bot_id,
    telegram_user_id,
    telegram_bot_link_id
)
VALUES (
    ?,
    ?,
    (
        SELECT
            id
        FROM
            telegram_bot_link
        WHERE
            guid = ?
            AND telegram_bot_id = ?
    )
)
ON CONFLICT ( telegram_bot_id, telegram_user_id ) DO NOTHING RETURNING id`.prepare(),

    "getFile": sql`SELECT * FROM telegram_bot_file WHERE file_id = ?`.prepare(),
};

export default class TelegramBot {
    #app;
    #telegram;
    #component;
    #dbh;
    #id;
    #type;
    #isStatic;
    #name;
    #shortDescription;
    #description;
    #telegramId;
    #telegramUsername;
    #telegramCanJoinGroups;
    #telegramCanReadAllGroupMessages;
    #telegramSupportsInlineQueries;

    #locales;

    #telegramBotApi;
    #started;

    #isShuttingDown = false;
    #updater;
    #processor;
    #users;
    #mutexSet = new Mutex.Set();
    #files;

    #modules;
    #webAppSecretKey;

    constructor ( telegram, component, id, type, fields ) {
        this.#app = telegram.app;
        this.#telegram = telegram;
        this.#component = component;
        this.#dbh = telegram.dbh;
        this.#id = id;
        this.#type = type;
        this.#isStatic = fields.static;
        this.#telegramId = fields.telegram_id;
        this.#telegramBotApi = new TelegramBotApi( fields.telegram_api_token );

        this.updateTelegramBotFields( fields );

        this.#updater = new TelegramBotUpdater( this );
        this.#processor = new TelegramBotProcessor( this, this.#onTelegramUpdate.bind( this ) );

        this.#users = new TelegramBotUsers( this );

        this.#files = new TelegramBotFiles( this );

        this.#modules = new Modules( this );
    }

    // properties
    get app () {
        return this.#app;
    }

    get telegram () {
        return this.#telegram;
    }

    get component () {
        return this.#component;
    }

    get config () {
        return this.component.config;
    }

    get dbh () {
        return this.#dbh;
    }

    get type () {
        return this.#type;
    }

    get id () {
        return this.#id;
    }

    get isStatic () {
        return this.#isStatic;
    }

    get telegramId () {
        return this.#telegramId;
    }

    get telegramUsername () {
        return this.#telegramUsername;
    }

    get name () {
        return this.#name;
    }

    get shortDescription () {
        return this.#shortDescription;
    }

    get description () {
        return this.#description;
    }

    get telegramBotApi () {
        return this.#telegramBotApi;
    }

    get isStarted () {
        return this.#started;
    }

    get isShuttingDown () {
        return this.#isShuttingDown;
    }

    get locales () {
        return this.#locales;
    }

    get files () {
        return this.#files;
    }

    get modules () {
        return this.#modules;
    }

    // public
    async init () {
        var res;

        res = await this.#modules.init();
        if ( !res.ok ) return res;

        return result( 200 );
    }

    async start () {
        if ( this.#isShuttingDown ) return;

        if ( !this.#started ) return;

        if ( this.telegram.config.runUpdater ) this.#updater.start();

        if ( this.telegram.config.runProcessor ) this.#processor.start();
    }

    async stop () {
        return Promise.all( [

            //
            this.#updater.stop(),
            this.#processor.stop(),
        ] );
    }

    async shutDown () {
        this.#isShuttingDown = true;

        await this.stop();

        this.#users.destroy();
    }

    async canStart () {
        return result( 200 );
    }

    async updateTelegramData () {
        return this.#updateTelegramData();
    }

    async setStarted ( started, { error } = {} ) {
        if ( started ) {
            var res = await this.canStart();

            if ( !res.ok ) {
                await this.setStatted( false, { "error": res.statusText } );

                return res;
            }
            else {
                res = await this.dbh.do( SQL.setStarted, [true, false, null, this.id] );

                if ( !res.ok ) return res;

                return result( 200 );
            }
        }
        else {
            const res = await this.dbh.do( SQL.setStarted, [false, !!error, error, this.id] );

            if ( !res.ok ) return res;

            return result( 200 );
        }
    }

    async setApiToken ( apiToken ) {
        return this.#updateTelegramData( apiToken );
    }

    get users () {
        return this.#users;
    }

    updateTelegramBotFields ( fields ) {
        if ( "telegram_api_token" in fields ) {
            this.#telegramBotApi.apiToken = fields.telegram_api_token;
            this.#webAppSecretKey = null;
        }

        if ( "telegram_username" in fields ) this.#telegramUsername = fields.telegram_username;

        if ( "name" in fields ) this.#name = fields.name;
        if ( "short_description" in fields ) this.#shortDescription = fields.short_description;
        if ( "description" in fields ) this.#description = fields.description;

        if ( "telegram_can_join_groups" in fields ) this.#telegramCanJoinGroups = fields.telegram_can_join_groups;

        if ( "telegram_can_read_all_group_messages" in fields ) this.#telegramCanReadAllGroupMessages = fields.telegram_can_read_all_group_messages;

        if ( "telegram_supports_inline_queries" in fields ) this.#telegramSupportsInlineQueries = fields.telegram_supports_inline_queries;

        if ( "started" in fields ) {
            const oldValue = this.#started;
            this.#started = fields.started;

            if ( oldValue != null ) {
                if ( this.#started ) {
                    this.start();
                }
                else {
                    this.stop();
                }
            }
        }

        if ( "locales" in fields ) {
            let locales = fields.locales;

            if ( !locales?.length ) {
                locales = this.app.locales.locales;
            }

            this.#locales = new Locales( this.#component.locales.merge( locales ), {
                "defaultLocale": fields.default_locale || this.app.locales.defaultLocale,
            } );

            this.#users?.clear();
        }
    }

    // XXX session
    validateWebAppInitialData ( webAppInitialData ) {
        webAppInitialData = new URLSearchParams( webAppInitialData );

        const hash = webAppInitialData.get( "hash" );
        webAppInitialData.delete( "hash" );

        webAppInitialData.sort();

        const dataToCheck = [];

        for ( const [key, value] of webAppInitialData.entries() ) {
            dataToCheck.push( key + "=" + value );
        }

        this.#webAppSecretKey ??= crypto.createHmac( "sha256", "WebAppData" ).update( this.#telegramBotApi.apiToken ).digest();

        return hash === crypto.createHmac( "sha256", this.#webAppSecretKey ).update( dataToCheck.join( "\n" ) ).digest( "hex" );
    }

    // protected
    async _createUser ( dbh, telegramBotUserId ) {
        return result( 200 );
    }

    // private
    // XXX
    async #onTelegramUpdate ( req ) {

        // inline query
        if ( req.isInlineQuery || req.isChosenInlineResult ) {
            return;
        }

        // private chat
        else if ( req.chat.type === "private" ) {
            return this.#privateChatUpdate( req );
        }

        // channel
        else if ( req.chat.type === "channel" ) {

            // XXX
        }

        // supergroup
        else if ( req.chat?.type === "supergroup" ) {

            // XXX
        }
    }

    // XXX
    async #privateChatUpdate ( req ) {

        // private chat with user
        var user;

        // get user
        user = await this.#users.getByTelegramId( req.from.id );

        // create user
        if ( !user ) {
            let linkGuid;

            // decode start params
            if ( req.command === "start" ) {
                if ( req.decodedCommandData?.method === "link" ) {
                    linkGuid = uuidFromBuffer( req.decodedCommandData.args[0] );
                }
            }

            await this.#createUser( {
                ...req.from,
                linkGuid,
            } );

            user = await this.#users.getByTelegramId( req.from.id );
        }

        // update user
        else {
            await user.setTelegramFields( req.from );

            if ( !user.isSubscribed ) await user.setSubscribed( true );
        }

        // aborted
        if ( req.isaborted ) return;

        // my_chat_member
        if ( req.isMyChatMember ) {

            // user restored
            if ( req.data.new_chat_member.status === "member" ) {
                if ( !user.isSubscribed ) await user.setSubscribed( true );
            }

            // user blocked
            else if ( req.data.new_chat_member.status === "kicked" ) {
                if ( user.isSubscribed ) await user.setSubscribed( false );
            }
        }

        // user is banned
        if ( user.isBanned ) return;

        // messagge
        if ( req.isMessage ) {

            // contact
            if ( req.data.contact ) {
                await user.updateContact( req.data.contact );
            }
        }

        // callbacl query
        else if ( req.isCallbackQuery ) {
            const callbackData = this.telegram.decodeCallbackData( req.data.data );

            // unable to parse callback data
            if ( !callbackData ) return;

            const idx = callbackData.method.lastIndexOf( "/" );

            const module = callbackData.method.substring( 0, idx ),
                method = "API_" + callbackData.method.substring( idx + 1 );

            // module method os not found
            if ( typeof this.#modules.get( module )?.[method] !== "function" ) return;

            // create context
            const ctx = new TelegramBotContext( this, user, req, {
                module,
            } );

            try {
                return this.#modules.get( module )[method]( ctx, ...callbackData.args );
            }
            catch ( e ) {
                return result.catch( e, { "keepError": true } );
            }
        }

        // XXX log request ???

        if ( !req.isMessage ) return;

        // create context
        const ctx = new TelegramBotContext( this, user, req, {
            "module": "start",
        } );

        return this.#modules.get( "start" ).processRequest( ctx, req );
    }

    async #updateTelegramData ( apiToken ) {

        // api token not changed
        if ( apiToken && apiToken === this.#telegramBotApi.apiToken ) return result( 200 );

        const api = apiToken ? new TelegramBotApi( apiToken ) : this.#telegramBotApi;

        var res = await api.getMe();
        if ( !res.ok ) return res;

        if ( res.data.id + "" !== this.#telegramId ) return result( [401, `Api token is not valid`] );

        var fields = new Map();

        if ( this.#telegramUsername !== res.data.username ) fields.set( "telegram_username", res.data.username );
        if ( this.#name !== res.data.first_name ) fields.set( "name", res.data.first_name );
        if ( this.#telegramCanJoinGroups !== res.data.can_join_groups ) fields.set( "telegram_can_join_groups", res.data.can_join_groups );
        if ( this.#telegramCanReadAllGroupMessages !== res.data.can_read_all_group_messages ) fields.set( "telegram_can_read_all_group_messages", res.data.can_read_all_group_messages );
        if ( this.#telegramSupportsInlineQueries !== res.data.supports_inline_queries ) fields.set( "telegram_supports_inline_queries", res.data.supports_inline_queries );

        // short description
        res = await api.getMyShortDescription();
        if ( !res.ok ) return res;
        if ( this.#shortDescription !== res.data.short_description ) fields.set( "short_description", res.data.short_description );

        // description
        res = await api.getMyDescription();
        if ( !res.ok ) return res;
        if ( this.#description !== res.data.description ) fields.set( "description", res.data.description );

        // update fields
        if ( fields.size ) {
            fields = Object.fromEntries( fields.entries() );

            res = await this.dbh.do( sql`UPDATE telegram_bot`.SET( fields ).sql`WHERE id = ${this.#id}` );
            if ( !res.ok ) return res;

            this.updateTelegramBotFields( fields );
        }

        // update api token
        if ( apiToken ) {
            res = await this.dbh.do( SQL.setApiToken, [apiToken, this.id] );
            if ( !res.ok ) return res;

            this.updateTelegramBotFields( {
                "telegram_api_token": apiToken,
            } );
        }

        return result( 200 );
    }

    async #createUser ( options ) {
        const mutex = this.#mutexSet.get( "create-user/" + options.id );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this.dbh.begin( async dbh => {
            var res;

            res = await dbh.selectRow( SQL.createTelegramUser, [

                //
                options.id,
                options.is_bot,
                options.username,
                options.first_name,
                options.last_name,
            ] );

            if ( !res.ok ) throw res;

            const telegramUserId = res.data.id;

            res = await dbh.selectRow( SQL.createTelegramBotUser, [

                //
                this.id,
                telegramUserId,
                options.linkGuid,
                this.id,
            ] );

            if ( !res.ok ) throw res;

            const telegramBotUserId = res.data.id;

            if ( !telegramBotUserId ) throw `User already exists`;

            res = await this._createUser( dbh, telegramBotUserId );

            if ( !res.ok ) throw res;
        } );

        mutex.unlock( res );

        return res;
    }
}
