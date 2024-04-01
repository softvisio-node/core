import sql from "#lib/sql";

const SQL = {
    "getGroup": sql`SELECT telegram_group_id FROM telegram_bot_forum_chat WHERE telegram_bot_id = ?`.prepare(),

    "createUserTopic": sql`INSERT INTO telegram_bot_forum_chat_group_topic ( telegram_group_id, topic_id, telegram_user_id, name ) VALUES ( ?, ?, ?, ? ) RETURNING topic_id, telegram_user_id, name`.prepare(),

    "updateUserTopicName": sql`UPDATE telegram_bot_forum_chat_group_topic SET name = ? WHERE telegram_group_id = ? AND telegram_user_id = ?`,

    "getUserTopic": sql`SELECT topic_id, telegram_user_id, name FROM telegram_bot_forum_chat_group_topic WHERE telegram_group_id = ? AND telegram_user_id = ?`.prepare(),

    "getTopicUser": sql`SELECT topic_id, telegram_user_id, name FROM telegram_bot_forum_chat_group_topic WHERE telegram_group_id = ? AND topic_id = ?`.prepare(),
};

export default class {
    #bot;
    #groupId;
    #inviteLink;
    #generalTopicHidden;
    #chatPermissionsSet;
    #userTopic = {};
    #topicUser = {};

    constructor ( bot ) {
        this.#bot = bot;
    }

    // proprties
    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    get groupId () {
        return this.#groupId;
    }

    get inviteLink () {
        return this.#inviteLink;
    }

    // public
    // XXX
    async init () {
        this.bot.dbhEvents.on( "disconnect", this.#clear.bind( this ) );

        const res = await this.dbh.selectRow( SQL.getGroup, [ this.bot.id ] );
        if ( !res.ok ) return res;

        if ( !res.data ) return result( [ 500, `Forum chat group is not set` ] );

        this.#groupId = res.data.telegram_group_id;

        const group = await this.getGroup();

        if ( group ) {
            const res = await this.#initGroup();

            if ( !res.ok ) return res;
        }
        else {

            // XXX get chat, create bot group
        }

        return result( 200 );
    }

    async getGroup ( { dbh } = {} ) {
        return this.bot.groups.getById( this.#groupId, { dbh } );
    }

    async getUserTopic ( user ) {
        var topic = this.#userTopic[ user.id ];

        GET_TOPIC: if ( !topic ) {
            const group = await this.getGroup();
            if ( !group ) break GET_TOPIC;

            let res;

            res = await this.dbh.selectRow( SQL.getUserTopic, [ group.id, user.id ] );

            if ( !res.ok ) {
                break GET_TOPIC;
            }
            else if ( res.data ) {
                topic = this.#cacheUserTopic( group, res.data );
            }
            else {
                res = await group.send( "createForumTopic", {
                    "name": user.username,
                } );

                if ( !res.ok ) break GET_TOPIC;

                const topicId = res.data.message_thread_id;

                res = await this.dbh.selectRow( SQL.createUserTopic, [ group.id, topicId, user.id, user.username ] );

                if ( !res.ok ) break GET_TOPIC;

                topic = this.#cacheUserTopic( group, res.data );
            }
        }

        if ( !topic ) return;

        if ( topic.name !== user.username ) await this.#updateUserTopicName( user );

        return topic.topicId;
    }

    async getTopicUser ( topicId ) {
        var topic = this.#topicUser[ topicId ];

        GET_TOPIC: if ( !topic ) {
            const group = await this.getGroup();
            if ( !group ) break GET_TOPIC;

            const res = await this.dbh.selectRow( SQL.getTopicUser, [ group.id, topicId ] );

            if ( !res.data ) break GET_TOPIC;

            topic = this.#cacheUserTopic( group, res.data );
        }

        if ( !topic ) return;

        const user = this.bot.users.getById( topic.userId );

        if ( !user ) return;

        if ( topic.name !== user.username ) await this.#updateUserTopicName( user );

        return user;
    }

    // XXX
    async runSupergroupRequest ( ctx, req ) {
        const userId = req.from.id,
            user = await this.bot.users.getById( userId );

        // group join request
        if ( req.isChatJoinRequest ) {
            const permissions = await user?.getPermissions();

            var res;

            // approve
            if ( permissions?.has( "telegram/bot:read" ) ) {
                res = await ctx.group.send( "approveChatJoinRequest", {
                    "user_id": user.id,
                } );

                if ( res.ok ) {
                    res = await user.sendMessage( {
                        "text": l10nt( `Your join request has been approved.` ),
                        "reply_markup": {
                            "inline_keyboard": [
                                [
                                    {
                                        "text": l10nt( `Open chats with customers` ),
                                        "url": ctx.group.getTopicUrl(),
                                    },
                                ],
                            ],
                        },
                    } );
                }
                else {
                    res = await user.sendText( l10nt( `Some error occured. Please, try again.` ) );
                }
            }

            // decline
            else {
                res = await ctx.group.send( "declineChatJoinRequest", {
                    "user_id": userId,
                } );

                if ( user ) {
                    res = await user.sendText( l10nt( `Your group join request has been declined.` ) );
                }
            }
        }

        // message
        else if ( req.isMessage ) {
            const targetUser = await this.getTopicUser( req.data.message_thread_id );

            if ( !targetUser ) return;

            await targetUser.send( "copyMessage", {
                "from_chat_id": ctx.group.id,
                "message_id": req.data.message_id,
            } );
        }
    }

    // private
    async #initGroup () {
        const group = await this.getGroup();

        // group not found
        if ( !group ) return result( 404 );

        var res;

        res = await this.dbh.selectRow( sql`SELECT * FROM telegram_bot_forum_chat_group WHERE telegram_group_id = ?`, [ this.#groupId ] );
        if ( !res.ok ) return res;

        if ( res.data ) {
            this.#inviteLink = res.data.invile_link;

            this.#generalTopicHidden = res.data.general_topic_hidden;

            this.#chatPermissionsSet = res.data.chat_permissions_set;
        }
        else {
            res = await this.dbh.do( sql`INSERT INTO telegram_bot_forum_chat_group ( telegram_group_id ) VALUES ( ? )`, [ this.#groupId ] );
            if ( !res.ok ) return res;
        }

        // hide general topic
        if ( this.bot.config.forumChat.hideGeneralTopic && !this.#generalTopicHidden ) {
            res = await group.send( "hideGeneralForumTopic" );
            if ( !res.ok ) return res;

            res = await this.dbh.do( sql`UPDATE telegram_bot_forum_chat_group SET general_topic_hidden = TRUE WHERE telegram_group_id = ?`, [ this.#groupId ] );
            if ( !res.ok ) return res;

            this.#generalTopicHidden = true;
        }

        // create invite link
        if ( !this.#inviteLink ) {
            res = await group.send( "createChatInviteLink", {
                "creates_join_request": true,
            } );
            if ( !res.ok ) return res;

            const inviteLink = res.data.invite_link;

            res = await this.dbh.do( sql`UPDATE telegram_bot_forum_chat_group SET invile_link = ? WHERE telegram_group_id = ?`, [ inviteLink, this.#groupId ] );
            if ( !res.ok ) return res;

            this.#inviteLink = inviteLink;
        }

        // set default roup user permissions
        if ( !this.#chatPermissionsSet ) {
            res = await group.send( "setChatPermissions", {
                "use_independent_chat_permissions": false,
                "permissions": {
                    "can_send_messages": true,
                    "can_send_audios": true,
                    "can_send_documents": true,
                    "can_send_photos": true,
                    "can_send_videos": true,
                    "can_send_video_notes": true,
                    "can_send_voice_notes": true,
                    "can_send_polls": true,
                    "can_send_other_messages": true,
                    "can_add_web_page_previews": true,
                    "can_change_info": false,
                    "can_invite_users": false,
                    "can_pin_messages": true,
                    "can_manage_topics": false,
                },
            } );
            if ( !res.ok ) return res;

            res = await this.dbh.do( sql`UPDATE telegram_bot_forum_chat_group SET chat_permissions_set = TRUE WHERE telegram_group_id = ?`, [ this.#groupId ] );
            if ( !res.ok ) return res;

            this.#chatPermissionsSet = true;
        }

        return result( 200 );
    }

    #clear () {
        this.#userTopic = {};
        this.#topicUser = {};
    }

    #cacheUserTopic ( group, fields ) {
        const topic = {
            "groupId": group.id,
            "topicId": fields.topic_id,
            "userId": fields.telegram_user_id,
            "name": fields.name,
        };

        this.#topicUser[ topic.topicId ] = topic;

        this.#userTopic[ topic.userId ] = topic;

        return topic;
    }

    async #updateUserTopicName ( user ) {
        const topic = this.#userTopic[ user.id ];
        if ( !topic ) return;

        const name = user.username;

        if ( topic.name === name ) return;

        const group = await this.getGroup();
        if ( !group ) return;

        var res;

        res = await group.send( "editForumTopic", {
            "message_thread_id": topic.topicId,
            name,
        } );
        if ( !res.ok ) return;

        res = await this.dbh.do( SQL.updateUserTopicName, [ name, group.id, user.id ] );
        if ( !res.ok ) return;
        if ( !res.meta.rows ) return;

        if ( this.#userTopic[ user.id ]?.groupId === group.id ) {
            this.#userTopic[ user.id ].name = name;

            this.#topicUser[ topic.topicId ].name = name;
        }
    }
}
