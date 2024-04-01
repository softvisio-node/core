import sql from "#lib/sql";
import TelegramBotApi from "#lib/api/telegram/bot";
import TelegramBotContext from "./bot/context.js";
import Mutex from "#lib/threads/mutex";
import TelegramBotUpdater from "./bot/updater.js";
import TelegramBotProcessor from "./bot/processor.js";
import TelegramBotUsers from "./bot/users.js";
import TelegramBotGroups from "./bot/groups.js";
import TelegramBotChannels from "./bot/channels.js";
import TelegramBotLinks from "./bot/links.js";
import TelegramBotFiles from "./bot/files.js";
import TelegramBotMessages from "./bot/messages.js";
import TelegramBotContacts from "./bot/contacts.js";
import crypto from "node:crypto";
import Commands from "./bot/commands.js";
import Events from "#lib/events";

const SQL = {
    "setApiToken": sql`UPDATE telegram_bot_api_token SET api_token = ? WHERE telegram_bot_id = ?`.prepare(),

    "setStarted": sql`UPDATE telegram_bot SET started = ?, error = ?, error_text = ? WHERE id = ?`.prepare(),

    "createTelegramUser": sql`INSERT INTO telegram_user ( id, is_bot, username, first_name, last_name ) VALUES ( ?, ?, ?, ?, ? ) ON CONFLICT DO NOTHING`.prepare(),

    "createTelegramBotUser": sql`INSERT INTO telegram_bot_user ( telegram_bot_id, telegram_user_id  ) VALUES ( ?, ? ) ON CONFLICT DO NOTHING`.prepare(),

    "createTelegramGroup": sql`INSERT INTO telegram_group ( id, title, username, is_forum ) VALUES ( ?, ?, ?, ? ) ON CONFLICT DO NOTHING`.prepare(),

    "createTelegramBotGroup": sql`
INSERT INTO
    telegram_bot_group
(
    telegram_bot_id,
    telegram_group_id,
    status,
    can_be_edited,
    can_manage_chat,
    can_change_info,
    can_delete_messages,
    can_invite_users,
    can_restrict_members,
    can_pin_messages,
    can_manage_topics,
    can_promote_members,
    can_manage_video_chats,
    can_post_stories,
    can_edit_stories,
    can_delete_stories,
    is_anonymous,
    can_manage_voice_chats
)
VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )
ON CONFLICT DO NOTHING
`.prepare(),

    "createTelegramChannel": sql`INSERT INTO telegram_channel ( id, title, username ) VALUES ( ?, ?, ? ) ON CONFLICT DO NOTHING`.prepare(),

    "createTelegramBotChannel": sql`
INSERT INTO
    telegram_bot_channel
(
    telegram_bot_id,
    telegram_channel_id,
    status,
    can_be_edited,
    can_manage_chat,
    can_change_info,
    can_post_messages,
    can_edit_messages,
    can_delete_messages,
    can_invite_users,
    can_restrict_members,
    can_promote_members,
    can_manage_video_chats,
    can_post_stories,
    can_edit_stories,
    can_delete_stories,
    is_anonymous,
    can_manage_voice_chats
)
VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )
ON CONFLICT DO NOTHING
`.prepare(),
};

export default class TelegramBot {
    #app;
    #telegram;
    #component;
    #dbh;
    #id;
    #aclId;
    #type;
    #isStatic;
    #name;
    #shortDescription;
    #description;
    #username;
    #telegramCanJoinGroups;
    #telegramCanReadAllGroupMessages;
    #telegramSupportsInlineQueries;

    #locales;

    #api;
    #started;

    #isShuttingDown = false;
    #updater;
    #processor;
    #users;
    #groups;
    #channels;
    #mutexSet = new Mutex.Set();
    #links;
    #files;
    #messages;
    #contacts;
    #dbhEvents;

    #commands;
    #webAppSecretKey;

    constructor ( telegram, component, id, type, data ) {
        const fields = data.telegram_bot;

        this.#app = telegram.app;
        this.#telegram = telegram;
        this.#component = component;
        this.#dbh = telegram.dbh;
        this.#id = id;
        this.#aclId = fields.acl_id;
        this.#type = type;
        this.#isStatic = fields.static;
        this.#api = new TelegramBotApi( this.app.crypto.decrypt( data.telegram_bot_api_token ).toString( "latin1" ) );

        this.updateTelegramBotFields( fields );

        this.#updater = new TelegramBotUpdater( this );
        this.#processor = new TelegramBotProcessor( this, this.#onTelegramUpdate.bind( this ) );

        this.dbh.maxListeners++;
        this.#dbhEvents = new Events().link( this.dbh );

        this.#users = new TelegramBotUsers( this );
        this.#groups = new TelegramBotGroups( this );
        this.#channels = new TelegramBotChannels( this );
        this.#links = new TelegramBotLinks( this );
        this.#files = new TelegramBotFiles( this );
        this.#messages = new TelegramBotMessages( this );
        this.#contacts = new TelegramBotContacts( this );

        this.#commands = new Commands( this );
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

    get aclId () {
        return this.#aclId;
    }

    get isStatic () {
        return this.#isStatic;
    }

    get username () {
        return this.#username;
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

    get api () {
        return this.#api;
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

    get links () {
        return this.#links;
    }

    get files () {
        return this.#files;
    }

    get messages () {
        return this.#messages;
    }

    get contacts () {
        return this.#contacts;
    }

    get commands () {
        return this.#commands;
    }

    get users () {
        return this.#users;
    }

    get groups () {
        return this.#groups;
    }

    get channels () {
        return this.#channels;
    }

    get dbhEvents () {
        return this.#dbhEvents;
    }

    // public
    async init () {
        var res;

        res = await this.#commands.init();
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

        this.#dbhEvents.unlinkAll();
        this.dbh.maxListeners--;
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
                res = await this.dbh.do( SQL.setStarted, [ true, false, null, this.id ] );

                if ( !res.ok ) return res;

                return result( 200 );
            }
        }
        else {
            const res = await this.dbh.do( SQL.setStarted, [ false, !!error, error, this.id ] );

            if ( !res.ok ) return res;

            return result( 200 );
        }
    }

    async setApiToken ( apiToken ) {
        return this.#updateTelegramData( apiToken );
    }

    updateTelegramBotFields ( fields ) {
        if ( "telegram_bot_api_token" in fields ) {
            this.#api.apiToken = this.app.crypto.decrypt( fields.telegram_bot_api_token ).toString( "latin1" );

            this.#webAppSecretKey = null;
        }

        if ( "username" in fields ) this.#username = fields.username;

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
            this.#locales = this.#component.locales.merge( fields.locales, {
                "defaultLocale": fields.default_locale,
            } );

            this.#users?.clear();
        }
    }

    async authenticateWebApp ( webAppInitData ) {
        try {
            webAppInitData = new URLSearchParams( webAppInitData );

            const hash = webAppInitData.get( "hash" );
            webAppInitData.delete( "hash" );

            webAppInitData.sort();

            const dataToCheck = [];

            for ( const [ key, value ] of webAppInitData.entries() ) {
                dataToCheck.push( key + "=" + value );
            }

            this.#webAppSecretKey ??= crypto.createHmac( "sha256", "WebAppData" ).update( this.#api.apiToken ).digest();

            if ( hash !== crypto.createHmac( "sha256", this.#webAppSecretKey ).update( dataToCheck.join( "\n" ) ).digest( "hex" ) ) return;

            let user = JSON.parse( webAppInitData.get( "user" ) );

            const botUser = await this.users.getById( user.id );

            if ( !botUser?.apiUserId ) return;

            user = await botUser.getApiUser();

            // user not found or disabled
            if ( !user?.isEnabled ) return;

            return user;
        }
        catch ( e ) {}
    }

    // protected
    async _createUser ( dbh, telegramUserId ) {
        return result( 200 );
    }

    async _createGroup ( dbh, telegramGroupId ) {
        return result( 200 );
    }

    async _createChannel ( dbh, telegramChannelId ) {
        return result( 200 );
    }

    async _runSupergroupRequest ( ctx, req ) {
        return result( 200 );
    }

    async _runChannelRequest ( ctx, req ) {
        return result( 200 );
    }

    async _runInlineQueryRequest ( ctx, req ) {
        return result( 200 );
    }

    // private
    async #onTelegramUpdate ( req ) {

        // private chat
        if ( req.chat?.type === "private" ) {
            return this.#runPrivateRequest( req );
        }

        // supergroup
        else if ( req.chat?.type === "supergroup" ) {
            return this.#runSupergroupRequest( req );
        }

        // channel
        else if ( req.chat?.type === "channel" ) {
            return this.#runChannelRequest( req );
        }

        // inline query
        else if ( req.isInlineQuery || req.isChosenInlineResult ) {
            return this.#runInlineQueryRequest( req );
        }
    }

    async #runPrivateRequest ( req ) {
        var user, newUser;

        // get user
        user = await this.#users.getById( req.from.id );

        // create user
        if ( !user ) {
            newUser = true;

            await this.#createUser( req.from );

            user = await this.#users.getById( req.from.id );
        }

        // update user
        else {
            await user.setTelegramUserFields( req.from );
        }

        // aborted
        if ( req.isaborted ) return;

        // my_chat_member
        if ( req.isMyChatMember ) {
            await user.setSubscribed( req.data.new_chat_member.status === "member" );
        }
        else {
            if ( !user.isSubscribed ) await user.setSubscribed( true );
        }

        // aborted
        if ( req.isaborted ) return;

        // user is banned
        if ( user.isBanned ) return;

        // messagge
        if ( req.isMessage ) {

            // contact
            if ( req.message.contact ) {
                await user.updateContact( req.message.contact );
            }
        }

        const ctx = new TelegramBotContext( {
            "bot": this,
            "command": "start",
            user,
            "permissions": await user.getPermissions(),
            newUser,
            req,
        } );

        return this.#commands.get( "start" ).runPrivateRequest( ctx, req );
    }

    async #runSupergroupRequest ( req ) {
        var group;

        // get user
        group = await this.#groups.getById( req.chat.id );

        // create user
        if ( !group ) {
            await this.#createGroup( req.chat );

            group = await this.#groups.getById( req.chat.id );
        }

        // update user
        else {
            await group.setTelegramGroupFields( req.chat );
        }

        // aborted
        if ( req.isaborted ) return;

        // my_chat_member
        if ( req.isMyChatMember ) {
            if ( req.data.new_chat_member.user.id === this.id ) {
                await group.setTelegramBotGroupFields( req.data.new_chat_member );
            }
        }

        // aborted
        if ( req.isaborted ) return;

        const ctx = new TelegramBotContext( {
            "bot": this,
            "command": null,
            group,
            "permissions": null,
            "newUser": null,
            req,
        } );

        return this._runSupergroupRequest( ctx, req );
    }

    async #runChannelRequest ( req ) {
        var channel;

        // get user
        channel = await this.#channels.getById( req.chat.id );

        // create user
        if ( !channel ) {
            await this.#createChannel( req.chat );

            channel = await this.#channels.getById( req.chat.id );
        }

        // update user
        else {
            await channel.setTelegramChannelFields( req.chat );
        }

        // aborted
        if ( req.isaborted ) return;

        // my_chat_member
        if ( req.isMyChatMember ) {
            if ( req.data.new_chat_member.user.id === this.id ) {
                await channel.setTelegramBotChannelFields( req.data.new_chat_member );
            }
        }

        // aborted
        if ( req.isaborted ) return;

        const ctx = new TelegramBotContext( {
            "bot": this,
            "command": null,
            channel,
            "permissions": null,
            "newUser": null,
            req,
        } );

        return this._runChannelRequest( ctx, req );
    }

    // XXX
    async #runInlineQueryRequest ( req ) {
        const ctx = new TelegramBotContext( {
            "bot": this,
            "command": null,
            "user": null,
            "permissions": null,
            "newUser": null,
            req,
        } );

        return this._runInlineQueryRequest( ctx, req );
    }

    async #updateTelegramData ( apiToken ) {

        // api token not changed
        if ( apiToken && apiToken === this.#api.apiToken ) return result( 200 );

        const api = apiToken ? new TelegramBotApi( apiToken ) : this.#api;

        var res = await api.getMe();
        if ( !res.ok ) return res;

        if ( res.data.id !== this.#id ) return result( [ 401, `Api token is not valid` ] );

        var fields = new Map();

        if ( this.#username !== res.data.username ) fields.set( "username", res.data.username );
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

            res = await this.dbh.do( sql`UPDATE telegram_bot`.SET( fields ).sql`WHERE id = ${ this.#id }` );
            if ( !res.ok ) return res;

            this.updateTelegramBotFields( fields );
        }

        // update api token
        if ( apiToken ) {
            apiToken = this.app.crypto.encrypt( apiToken );

            res = await this.dbh.do( SQL.setApiToken, [ apiToken, this.id ] );
            if ( !res.ok ) return res;

            this.updateTelegramBotFields( {
                "telegram_bot_api_token": apiToken,
            } );
        }

        return result( 200 );
    }

    async #createUser ( from ) {
        const mutex = this.#mutexSet.get( "create-user/" + from.id );

        if ( !mutex.tryLock() ) return mutex.wait();

        const res = await this.dbh.begin( async dbh => {
            var res;

            // create telegram user
            res = await dbh.do( SQL.createTelegramUser, [

                //
                from.id,
                from.is_bot,
                from.username,
                from.first_name,
                from.last_name,
            ] );

            if ( !res.ok ) throw res;

            // create telegram bot user
            res = await dbh.do( SQL.createTelegramBotUser, [

                //
                this.id,
                from.id,
            ] );

            if ( !res.ok ) throw res;

            res = await this._createUser( dbh, from.id );

            if ( !res.ok ) throw res;
        } );

        mutex.unlock( res );

        return res;
    }

    async #createGroup ( chat ) {
        const mutex = this.#mutexSet.get( "create-group/" + chat.id );

        if ( !mutex.tryLock() ) return mutex.wait();

        var res;

        res = await this.api.getChatMember( {
            "chat_id": chat.id,
            "user_id": this.id,
        } );

        if ( res.ok ) {
            const chatMember = res.data;

            res = await this.dbh.begin( async dbh => {
                var res;

                // create telegram group
                res = await dbh.do( SQL.createTelegramGroup, [

                    //
                    chat.id,
                    chat.title,
                    chat.username,
                    chat.is_forum,
                ] );

                if ( !res.ok ) throw res;

                // create telegram bot user
                res = await dbh.do( SQL.createTelegramBotGroup, [

                    //
                    this.id,
                    chat.id,
                    chatMember.status,
                    chatMember.can_be_edited,
                    chatMember.can_manage_chat,
                    chatMember.can_change_info,
                    chatMember.can_delete_messages,
                    chatMember.can_invite_users,
                    chatMember.can_restrict_members,
                    chatMember.can_pin_messages,
                    chatMember.can_manage_topics,
                    chatMember.can_promote_members,
                    chatMember.can_manage_video_chats,
                    chatMember.can_post_stories,
                    chatMember.can_edit_stories,
                    chatMember.can_delete_stories,
                    chatMember.is_anonymous,
                    chatMember.can_manage_voice_chats,
                ] );

                if ( !res.ok ) throw res;

                res = await this._createGroup( dbh, chat.id );

                if ( !res.ok ) throw res;
            } );
        }

        mutex.unlock( res );

        return res;
    }

    async #createChannel ( chat ) {
        const mutex = this.#mutexSet.get( "create-channel/" + chat.id );

        if ( !mutex.tryLock() ) return mutex.wait();

        var res;

        res = await this.api.getChatMember( {
            "chat_id": chat.id,
            "user_id": this.id,
        } );

        if ( res.ok ) {
            const chatMember = res.data;

            res = await this.dbh.begin( async dbh => {
                var res;

                // create telegram channel
                res = await dbh.do( SQL.createTelegramChannel, [

                    //
                    chat.id,
                    chat.title,
                    chat.username,
                ] );

                if ( !res.ok ) throw res;

                // create telegram bot user
                res = await dbh.do( SQL.createTelegramBotChannel, [

                    //
                    this.id,
                    chat.id,
                    chatMember.status,
                    chatMember.can_be_edichatMember.ted,
                    chatMember.can_manage_chat,
                    chatMember.can_change_info,
                    chatMember.can_post_messages,
                    chatMember.can_edit_messages,
                    chatMember.can_delete_messages,
                    chatMember.can_invite_users,
                    chatMember.can_restrict_members,
                    chatMember.can_promote_members,
                    chatMember.can_manage_video_chats,
                    chatMember.can_post_stories,
                    chatMember.can_edit_stories,
                    chatMember.can_delete_stories,
                    chatMember.is_anonymous,
                    chatMember.can_manage_voice_chats,
                ] );

                if ( !res.ok ) throw res;

                res = await this._createChannel( dbh, chat.id );

                if ( !res.ok ) throw res;
            } );
        }

        mutex.unlock( res );

        return res;
    }
}
