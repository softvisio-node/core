import sql from "#core/sql";

const SQL = {
    "insertTelegram_BotForumChatGroup": sql`INSERT INTO telegram_bot_forum_chat_group ( telegram_group_id ) VALUES ( ? ) ON CONFLICT DO NOTHING`,
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
    async getUserTopic ( telegramUserId ) {}

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
