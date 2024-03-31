import sql from "#lib/sql";

const SQL = {
    "getGroup": sql`
SELECT
    telegram_bot_forum_chat.telegram_group_id,
    row_to_json( telegram_bot_forum_chat_group ) AS telegram_bot_forum_chat_group
FROM
    telegram_bot_forum_chat,
    telegram_bot_forum_chat_group
WHERE
    telegram_bot_forum_chat.telegram_bot_id = ?
    AND telegram_bot_forum_chat.telegram_group_id = telegram_bot_forum_chat_group.telegram_group_id
`.prepare(),

    "updateInviteLink": sql`UPDATE telegram_bot_forum_chat_group SET invite_link = ? WHERE telegram_group_id = ?`,

    // XXX
    "insertTelegram_BotForumChatGroup": sql`INSERT INTO telegram_bot_forum_chat_group ( telegram_group_id ) VALUES ( ? ) ON CONFLICT DO NOTHING`,

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

    // public
    // XXX
    async init () {
        this.bot.dbhEvents.on( "disconnect", this.#clear.bind( this ) );

        const res = await this.dbh.selectRow( SQL.getGroup, [ this.bot.id ] );
        if ( !res.ok ) return res;

        this.#groupId = res.data?.telegram_group_id;

        this.#updateFields( res.sata.telegram_bot_forum_chat_group );

        return result( 200 );
    }

    async getGroup ( { dbh } = {} ) {
        return this.bot.groups.getById( this.#groupId, { dbh } );
    }

    async getInviteLink ( { dbh } = {} ) {

        // group not set
        const group = await this.getGroup();
        if ( !group ) return;

        if ( this.#inviteLink ) return;

        const res = await this.#createInviteLink();
        if ( !res.ok ) return;

        return this.#inviteLink;
    }

    async createInviteLink () {
        return this.#createInviteLink();
    }

    // XXX
    async processJoinRequest ( user ) {
        const group = await this.getGroup();
        if ( !group ) return result( [ 500, `Group not found` ] );

        var res;

        // XXX
        const approve = true;

        if ( approve ) {
            res = group.send( "approveChatJoinRequest", {
                "user_id": user.id,
            } );
        }
        else {
            res = group.send( "declineChatJoinRequest", {
                "user_id": user.id,
            } );
        }

        return res;
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
    async setGroup ( telegramGroupUrl, { dbh } = {} ) {
        dbh ||= this.dbh;

        try {
            var url = new URL( telegramGroupUrl );
        }
        catch ( e ) {
            return result.catch( e, { "log": false } );
        }

        const labels = url.pathname.split( "/" );

        var newGroup;

        if ( labels[ 1 ] === "c" ) {
            const groupId = Number( "-100" + labels[ 2 ] );

            if ( isNaN( groupId ) ) return result( 404 );

            newGroup = await this.bot.groups.getById( groupId, { dbh } );

            if ( !newGroup ) {
                const res = await this.bot.api.send( "getChat", {
                    "chat_id": groupId + 1,
                } );

                // XXX
                console.log( "------", res );
                process.exit();

                // XXX
                if ( !res.ok ) return result( 404 );

                // XXX create bot group

                newGroup = await this.bot.groups.getById( groupId, { dbh } );
            }
        }
        else {

            // XXX
            newGroup = await this.bot.groups.getByUsername( labels[ 1 ], { dbh } );
        }

        // group not found
        if ( !newGroup ) return result( 404 );

        const currentGroup = await this.getGroup( { dbh } );

        // group not changed
        if ( currentGroup && currentGroup.id === newGroup.id ) return result( 200 );

        // XXX
        const res = await dbh.do();
        if ( !res.ok ) return res;

        this.#clear();

        this.#groupId = newGroup.id;

        return result( 200 );

        // const group = await this.bot.groups.getById(telegramGroupId);
        // if (!group) return result([400, `Group not found`]);

        // XXX check group permissiosn
        // XXX check group private
        // XXX check group id forum
        // XXX check bot group status - administrator

        // XXX hide general topic

        // const dbh = this.dbh;

        // res = await dbh.do( SQL.insertTelegram_BotForumChatGroup, [ telegramGroupId ] );

        // if ( !res.ok ) return res;

        // return res;
    }

    // private
    #clear () {
        this.#groupId = null;
        this.#inviteLink = null;
        this.#generalTopicHidden = null;

        this.#userTopic = {};
        this.#topicUser = {};
    }

    #updateFields ( fields ) {
        this.#inviteLink = fields.invile_link;

        this.#generalTopicHidden = fields.general_topic_hidden;
    }

    async #createInviteLink () {
        const group = await this.getGroup();
        if ( !group ) return result( [ 500, `Group not found` ] );

        var res;

        res = await group.send( "createChatInviteLink", {
            "name": "Forum chat invite link",
            "creates_join_request": true,
        } );
        if ( !res.ok ) return res;

        const inviteLink = res.data.invite_link;

        res = await this.dbh.do( SQL.updateInviteLink, [ inviteLink, group.id ] );
        if ( !res.ok ) return res;

        this.#inviteLink = inviteLink;

        return result( 200 );
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
