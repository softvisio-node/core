import TelegramChannel from "../channel.js";

// import sql from "#lib/sql";

// const SQL = {
//     "setSubscribed": sql`UPDATE telegram_bot_user SET subscribed = ? WHERE id = ?`.prepare(),

//     "setBanned": sql`UPDATE telegram_bot_user SET banned = ? WHERE id = ?`.prepare(),

//     "setState": sql`UPDATE telegram_bot_user SET state = ? WHERE id = ?`.prepare(),

//     "setLocale": sql`UPDATE telegram_bot_user SET locale = ? WHERE id = ?`.prepare(),
// };

export default class TelegramBotChannel extends TelegramChannel {
    #bot;
    #id;
    #status;
    #canBeEdited;
    #canManageChat;
    #canChangeInfo;
    #canPostMessages;
    #canEditMessages;
    #canDeleteMessages;
    #canInviteUsers;
    #canRestrictMembers;
    #canPromoteMembers;
    #canManageVideoChats;
    #canPostStories;
    #canEditStories;
    #canDeleteStories;
    #isAnonymous;
    #canManageVoiceChats;

    constructor ( bot, data ) {
        super( bot.telegram, data );

        this.#bot = bot;

        const fields = data.telegram_bot_channel;

        this.#id = fields.id;

        this.updateTelegramBotChannelFields( fields );
    }

    // properties
    get bot () {
        return this.#bot;
    }

    get app () {
        return this.#bot.app;
    }

    get id () {
        return this.#id;
    }

    get telegramId () {
        return super.id;
    }

    get status () {
        return this.#status;
    }

    get canBeEdited () {
        return this.#canBeEdited;
    }

    get canManageChat () {
        return this.#canManageChat;
    }

    get canChangeInfo () {
        return this.#canChangeInfo;
    }

    get canPostMessages () {
        return this.#canPostMessages;
    }

    get canEditMessages () {
        return this.#canEditMessages;
    }

    get canDeleteMessages () {
        return this.#canDeleteMessages;
    }

    get canInviteUsers () {
        return this.#canInviteUsers;
    }

    get canRestrictMembers () {
        return this.#canRestrictMembers;
    }

    get canPromoteMembers () {
        return this.#canPromoteMembers;
    }

    get canManageVideoChats () {
        return this.#canManageVideoChats;
    }

    get canPostStories () {
        return this.#canPostStories;
    }

    get canEditStories () {
        return this.#canEditStories;
    }

    get canDeleteStories () {
        return this.#canDeleteStories;
    }

    get isAnonymous () {
        return this.#isAnonymous;
    }

    get canManageVoiceChats () {
        return this.#canManageVoiceChats;
    }

    // public
    // XXX
    updateTelegramBotChannelFields ( fields ) {
        if ( "status" in fields ) this.#status = fields.status;
    }

    // XXX
    async setTelegramBotChannelFields ( fields ) {}

    // XXX
    toJSON () {

        // const data = super.toJSON();
        // data.telegram_user_id = data.id;
        // data.id = this.id;
        // data.avatar_url = this.avatarUrl;
        // return data;
    }
}
