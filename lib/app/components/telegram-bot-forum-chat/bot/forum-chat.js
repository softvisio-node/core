import sql from "#core/sql";

const SQL = {
    "insertTelegram_BotForumChatGroup": sql`INSERT INTO telegram_bot_forum_chat_group ( telegram_group_id ) VALUES ( ? ) ON CONFLICT DO NOTHING`,

    "getUserTopic": sql`
SELECT
    telegram_bot_forum_chat_group_topic.topic_id
FROM
    telegram_bot_forum_chat,
    telegram_bot_forum_chat_group,
    telegram_bot_forum_chat_group_topic
WHERE
    telegram_bot_forum_chat.telegram_bot_id = ?
    AND telegram_bot_forum_chat.telegram_group_id = telegram_bot_forum_chat_group.telegram_group_id
    AND telegram_bot_forum_chat_group.telegram_group_id = telegram_bot_forum_chat_group_topic.telegram_group_id
    AND telegram_bot_forum_chat_group_topic.telegram_user_id = ?
`.prepare(),

    "getTopicUser": sql`
SELECT
    telegram_bot_forum_chat_group_topic.telegram_user_id
FROM
    telegram_bot_forum_chat,
    telegram_bot_forum_chat_group,
    telegram_bot_forum_chat_group_topic
WHERE
    telegram_bot_forum_chat.telegram_bot_id = ?
    AND telegram_bot_forum_chat.telegram_group_id = telegram_bot_forum_chat_group.telegram_group_id
    AND telegram_bot_forum_chat_group.telegram_group_id = telegram_bot_forum_chat_group_topic.telegram_group_id
    AND telegram_bot_forum_chat_group_topic.topic_id = ?
`.prepare(),
};

export default class {
    #bot;

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
    async getUserTopic ( telegramUserId ) {
        var res;

        res = await this.dbh.selectRow( SQL.getUserTopic, [ this.bot.id, telegramUserId ] );

        if ( !res.ok ) return;

        if ( res.data.topic_id ) return res.data.topic_id;
    }

    async getTopicUser ( telegramUserId ) {}

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
}
