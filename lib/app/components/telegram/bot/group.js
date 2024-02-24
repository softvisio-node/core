export default class {
    #bot;
    #id;
    #url;

    constructor ( bot, id ) {
        this.#bot = bot;
        this.#id = id;
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get dbh () {
        return this.#bot.dbh;
    }

    get url () {
        this.#url ??= `https://t.me/c/${ this.#id.toString().replace( "-100", "" ) }`;

        return this.#url;
    }

    // public
    getTopicUrl ( topicId ) {
        return this.url + "/" + ( topicId || 1 );
    }

    async send ( method, data ) {
        data = data ? { ...data } : {};

        data.chat_id = this.#id;

        return this.#bot.telegramBotApi.send( method, data );
    }

    async hideGeneralForumTopic () {
        var res;

        res = await this.send( "hideGeneralForumTopic" );

        if ( !res.ok ) return res;

        return res;
    }

    async exportChatInviteLink () {
        return this.send( "exportChatInviteLink" );
    }

    async createChatInviteLink ( data ) {
        return this.send( "createChatInviteLink", data );
    }

    // XXX
    async approveChatJoinRequest () {}

    async setChatPhoto () {}

    async setChatPermissions () {}

    async getChat () {}

    async getChatMember ( userId ) {
        return this.send( "getChatMember", { "user_id": userId } );
    }

    async banChatMember ( userId ) {
        return this.send( "banChatMember", {
            "user_id": userId,
        } );
    }

    async unbanChatMember ( userId, { onlyIfBanned } = {} ) {
        return this.send( "unbanChatMember", {
            "user_id": userId,
            "only_if_banned": onlyIfBanned,
        } );
    }
}
