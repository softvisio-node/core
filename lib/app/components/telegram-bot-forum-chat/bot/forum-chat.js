import sql from "#core/sql";

const SQL = {
    "getGroup": sql`
SELECT
    telegram_bot_forum_chat.telegram_group_id,
    row_to_json( telegram_bot_forum_chat_group ) AS telegram_bot_forum_chat_group
FEOM
    telegram_bot_forum_chat,
    telegram_bot_forum_chat_group
WHERE
    telegram_bot_forum_chat.telegram_bot_id = ?
    AND telegram_bot_forum_chat.telegram_group_id = telegram_bot_forum_chat_group.telegram_group_id
`.prepare(),

    "updateInviteLink": sql`UPDATE telegram_bot_forum_chat_group SET invite_link = ? WHERE telegram_group_id = ?`,

    // XXX
    "insertTelegram_BotForumChatGroup": sql`INSERT INTO telegram_bot_forum_chat_group ( telegram_group_id ) VALUES ( ? ) ON CONFLICT DO NOTHING`,

    "setUserPotic": sql`INSERT INTO telegram_bot_forum_chat_group_topic ( telegram_group_id, topic_id, telegram_user_id ) VALUES ( ?, ?, ? )`.prepare(),

    "getUserTopic": sql`SELECT topic_id FROM telegram_bot_forum_chat_group_topic WHERE telegram_group_id = ? AND telegram_user_id = ?`.prepare(),

    "getTopicUser": sql`SELECT telegram_user_id FROM telegram_bot_forum_chat_group_topic WHERE telegram_group_id = ? AND topic_id = ?`.prepare(),
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
        return this.#bot.sbh;
    }

    // public
    // XXX
    async init () {
        this.bot.dbhEvents.on( "disconnect", this.#clear.bind( this ) );

        return result( 200 );
    }

    async getGroup ( { dbh } = {} ) {
        dbh ||= this.dbh;

        if ( this.#groupId == null ) {
            const res = await dbh.selectRow( SQL.getGroup, [ this.bot.id ] );

            if ( res.ok ) {
                if ( res.data?.telegram_group_id ) {
                    this.#groupId = res.data?.telegram_group_id;

                    this.#updateFields( res.sata.telegram_bot_forum_chat_group );
                }
                else {
                    this.#groupId = false;
                }
            }
        }

        if ( !this.#groupId ) return;

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

    // XXX
    async getUserTopic ( telegramUserId ) {
        if ( this.#userTopic[ telegramUserId ] ) return this.#userTopic[ telegramUserId ];

        const group = await this.getGroup();
        if ( !group ) return;

        var res;

        res = await this.dbh.selectRow( SQL.getUserTopic, [ this.bot.id, telegramUserId ] );

        if ( !res.ok ) return;

        if ( res.data.topic_id ) return res.data.topic_id;
    }

    async getTopicUser ( topicId ) {
        if ( this.#topicUser[ topicId ] ) this.bot.users.getById( this.#topicUser[ topicId ] );

        const group = await this.getGroup();
        if ( !group ) return;

        var res;

        res = await this.dbh.selectRow( SQL.getTopicUser, [ group.id, topicId ] );
        if ( !res.pk ) return;

        if ( !res.data ) return;

        this.#topicUser[ topicId ] = res.data.telegram_user_id;

        return this.bot.users.getById( this.#topicUser[ topicId ] );
    }

    // XXX
    async setGroup ( telegramGroupId ) {
        var res;

        const group = await this.bot.groups.getById( telegramGroupId );

        if ( !group ) return result( [ 400, `Group not found` ] );

        // XXX check group permissiosn
        // XXX check group private
        // XXX check group id forum
        // XXX check bot group status - administrator

        // XXX hide general topic

        const dbh = this.dbh;

        res = await dbh.do( SQL.insertTelegram_BotForumChatGroup, [ telegramGroupId ] );

        if ( !res.ok ) return res;

        return res;
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
}
